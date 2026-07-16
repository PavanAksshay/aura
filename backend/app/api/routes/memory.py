"""Patient Memory: semantic search over the clinician's own exported notes.

The query is embedded locally (fastembed) and matched in Postgres via the
service-role-only `match_note_chunks_scoped` function (migration 0006),
which is hard-scoped to the verified caller's user id — the service role
bypasses RLS, so the scoping lives in the function signature instead.
"""

import logging
import re
from typing import cast

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.ratelimit import rate_limit
from app.core.security import CurrentUser
from app.db.supabase import get_service_client
from app.models.schemas import (
    MemoryAnswer,
    MemoryMatchOut,
    MemorySearchRequest,
)
from app.services.embeddings import embed_texts
from app.services.memory_answer import answer_question

logger = logging.getLogger(__name__)
router = APIRouter()

# Empty SOAP sections index as "<Section>: No … content identified." — noise
# that shouldn't be shown as an answer or fed to the model.
_PLACEHOLDER = re.compile(r":\s*no\b.*\bidentified\.?\s*$", re.IGNORECASE)


def _is_placeholder(content: str) -> bool:
    return bool(_PLACEHOLDER.search(content.strip()))


def _retrieve(
    user_id: str, query: str, match_count: int, patient_id: str | None
) -> list[MemoryMatchOut]:
    [query_vector] = embed_texts([query])
    db = get_service_client()
    try:
        result = db.rpc(
            "match_note_chunks_scoped",
            {
                "p_user_id": user_id,
                "query_embedding": query_vector,
                "match_count": match_count,
                "filter_patient": patient_id,
            },
        ).execute()
    except Exception as exc:
        logger.exception("Memory retrieval failed")
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            detail="Memory search is unavailable. Has migration 0006 been applied?",
        ) from exc
    rows = cast(list[dict[str, object]], result.data or [])
    return [MemoryMatchOut.model_validate(row) for row in rows]


# Deliberately `def` (not `async def`): embedding is CPU-bound, so FastAPI
# should run this handler in its threadpool instead of blocking the loop.
@router.post(
    "/memory/search",
    response_model=list[MemoryMatchOut],
    # Embedding-only: cheap, but still CPU work.
    dependencies=[Depends(rate_limit(60, 60))],
)
def search_memory(body: MemorySearchRequest, user: CurrentUser) -> list[MemoryMatchOut]:
    query = body.query.strip()
    if not query:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Empty query.")
    return _retrieve(user.id, query, body.limit, body.patient_id)


@router.post(
    "/memory/ask",
    response_model=MemoryAnswer,
    # Each ask runs an Ollama generation on top of retrieval.
    dependencies=[Depends(rate_limit(20, 60))],
)
def ask_memory(body: MemorySearchRequest, user: CurrentUser) -> MemoryAnswer:
    """Answer a question from the caller's notes: a concise, specific answer
    plus the supporting excerpts — not a raw dump of every SOAP section."""
    query = body.query.strip()
    if not query:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Empty query.")

    # Over-fetch, then drop empty-SOAP placeholder chunks so the answer is drawn
    # from substantive notes only.
    candidates = _retrieve(user.id, query, max(body.limit * 3, 12), body.patient_id)
    useful = [m for m in candidates if not _is_placeholder(m.content)]

    answer, engine = answer_question(query, [m.content for m in useful])
    return MemoryAnswer(answer=answer, engine=engine, matches=useful[: body.limit])
