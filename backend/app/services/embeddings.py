"""Local semantic memory: chunk exported notes and embed them with fastembed.

Only *structured note* text is ever embedded — raw transcripts never reach
this module (they are purged in the same write that triggers it). Embeddings
are computed in-process with an ONNX model; nothing leaves the machine.
"""

import logging
import threading
from typing import Any, cast

from app.core.config import get_settings
from app.db.supabase import get_service_client
from app.models.schemas import SoapNote

logger = logging.getLogger(__name__)

_model_lock = threading.Lock()
_model: Any = None

_MAX_CHUNK_CHARS = 700


def _get_model() -> Any:
    global _model
    with _model_lock:
        if _model is None:
            from fastembed import TextEmbedding

            settings = get_settings()
            logger.info("Loading embedding model %s", settings.embedding_model)
            _model = TextEmbedding(model_name=settings.embedding_model)
    return _model


def chunk_note(note: SoapNote) -> list[str]:
    """One chunk per SOAP section; long sections split at sentence seams.

    Section labels stay inside the chunk text so retrieval hits carry their
    clinical framing ("Plan: increase exposure homework…").
    """
    chunks: list[str] = []
    for label, body in (
        ("Subjective", note.subjective),
        ("Objective", note.objective),
        ("Assessment", note.assessment),
        ("Plan", note.plan),
    ):
        text = body.strip()
        if not text:
            continue
        prefix = f"{label}: "
        budget = _MAX_CHUNK_CHARS - len(prefix)
        while len(text) > budget:
            cut = text.rfind(". ", 0, budget)
            if cut <= 0:
                cut = budget
            chunks.append(prefix + text[: cut + 1].strip())
            text = text[cut + 1 :].strip()
        if text:
            chunks.append(prefix + text)
    return chunks


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Embed a batch of strings → 768-dim vectors (see migration 0005)."""
    model = _get_model()
    return [[float(x) for x in vector] for vector in model.embed(texts)]


def index_exported_note(
    session_id: str,
    user_id: str,
    patient_id: str | None,
    note: SoapNote,
) -> None:
    """Background task run at export time: write the note into patient memory.

    Idempotent (re-export replaces the session's chunks) and deliberately
    non-fatal: a failed indexing never breaks the export itself — the note is
    already persisted and the transcript already purged by the time this runs.
    """
    try:
        chunks = chunk_note(note)
        if not chunks:
            return
        vectors = embed_texts(chunks)

        db = get_service_client()
        db.table("note_embeddings").delete().eq("session_id", session_id).eq(
            "user_id", user_id
        ).execute()
        db.table("note_embeddings").insert(
            cast(
                list[dict[str, Any]],
                [
                    {
                        "user_id": user_id,
                        "session_id": session_id,
                        "patient_id": patient_id,
                        "chunk_index": index,
                        "content": chunk,
                        "embedding": vector,
                    }
                    for index, (chunk, vector) in enumerate(
                        zip(chunks, vectors, strict=True)
                    )
                ],
            )
        ).execute()
        logger.info("Indexed %d memory chunks for session %s", len(chunks), session_id)
    except Exception:
        logger.exception("Failed to index note embeddings for session %s", session_id)
