"""Answer a clinician's question from their own retrieved note excerpts.

Preferred path: the local Ollama model reads the top matching note chunks and
writes a short, specific answer — so the clinician gets an actual answer rather
than a dump of raw SOAP sections. Fully on-device. If Ollama is unreachable it
falls back to surfacing the single most relevant excerpt.
"""

import logging

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)

_PROMPT = """You are a clinical assistant helping a psychologist recall details \
from their OWN therapy session notes. Answer the QUESTION using ONLY the note \
excerpts provided. Be specific and concise — 1 to 3 sentences, plain clinical \
language. If the excerpts do not contain the answer, reply exactly: "The notes \
don't record that yet." Do not invent details.

QUESTION: {question}

NOTE EXCERPTS:
{context}

ANSWER:"""


def answer_question(question: str, excerpts: list[str]) -> tuple[str, str]:
    """Return (answer, engine). engine is "ollama" or "heuristic"."""
    if not excerpts:
        return ("I couldn't find anything in your notes about that yet.", "heuristic")

    settings = get_settings()
    context = "\n".join(f"- {e.strip()}" for e in excerpts[:6])
    try:
        response = httpx.post(
            f"{settings.ollama_url}/api/generate",
            json={
                "model": settings.summary_model,
                "prompt": _PROMPT.format(question=question, context=context),
                "stream": False,
                "options": {"temperature": 0.2},
            },
            timeout=120.0,
        )
        response.raise_for_status()
        text = str(response.json().get("response", "")).strip()
        if text:
            return (text, "ollama")
    except Exception:
        logger.warning(
            "Ollama memory answer unavailable — falling back to top excerpt",
            exc_info=True,
        )

    # Heuristic fallback: surface the single most relevant excerpt verbatim.
    return (f"Based on your notes: {excerpts[0].strip()}", "heuristic")
