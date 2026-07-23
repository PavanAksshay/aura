"""Romanize a non-English transcript to the Latin alphabet (no Tamil/Hindi letters).

Whisper transcribes a Tamil or Hindi session in its own script. Clinicians here
asked for transcripts written only in Latin letters, so this rewrites the
transcript into readable romanized form — "romba tough-a irundhuchu" rather than
"ரொம்ப tough ஆ இருந்துச்சு".

Preferred path: the local model rewrites it in natural, colloquial romanization.
It is told to transliterate only — never translate, never change a word. Crucially
the session NOTE is built from the ORIGINAL transcript, not this romanized copy
(see retention.py), so any drift here touches only the human-readable transcript,
never the clinical note.

Fallback: if the model is unavailable, times out, or leaves script behind, a
deterministic mechanical transliteration guarantees no Indic letters remain — at
the cost of rougher output ("roṁbha irughghu").
"""

from __future__ import annotations

import logging
import re

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)

# Tamil (U+0B80..0BFF) and Devanagari (U+0900..097F): the scripts we romanize.
_INDIC = re.compile(r"[ऀ-ॿ஀-௿]")

# Devanagari sentence terminators (danda, double danda) that transliteration
# leaves untouched — map them to a full stop so no Indic characters remain.
_DANDA = {ord("।"): ".", ord("॥"): "."}

# Above this length we skip the model and go straight to mechanical: a long
# transcript risks the model dropping or reordering lines, and mechanical is
# deterministic at any length.
_LLM_MAX_CHARS = 8000

_PROMPT = """Rewrite this therapy-session transcript in the Latin alphabet \
(romanized). Transliterate the SOUND of each word — do NOT translate.

Rules:
- Keep every word in its original language (Tamil, Hindi, English). Only change \
Tamil/Hindi letters into Latin letters that sound the same. English words stay \
exactly as they already are.
- Keep the speaker labels ("Therapist:", "Patient:") and every line break.
- Do not add, remove, translate, summarize, or reorder anything. Same number of \
lines, same content.
- Output ONLY the romanized transcript, nothing else.

Transcript:
\"\"\"{text}\"\"\"
"""


def has_indic_letters(text: str) -> bool:
    """True if the text contains any Tamil or Devanagari characters."""
    return _INDIC.search(text) is not None


def _mechanical(text: str) -> str:
    """Deterministic script→Latin. Guarantees no Indic letters; reads roughly."""
    from indic_transliteration import sanscript
    from indic_transliteration.sanscript import transliterate

    out = transliterate(text, sanscript.TAMIL, sanscript.ISO)
    out = transliterate(out, sanscript.DEVANAGARI, sanscript.ISO)
    # Transliteration leaves danda punctuation as-is; normalise to a full stop.
    return out.translate(_DANDA)


def _plausible(original: str, candidate: str) -> bool:
    """Cheap guard against a refusal, a truncation, or a wholesale rewrite."""
    if not candidate.strip():
        return False
    # A transliteration is roughly the same size as its source.
    ratio = len(candidate) / max(1, len(original))
    if not 0.4 <= ratio <= 2.5:
        return False
    # Line structure (speaker turns) should be preserved.
    orig_lines = original.count("\n")
    cand_lines = candidate.count("\n")
    return abs(orig_lines - cand_lines) <= max(2, orig_lines // 3)


def _llm_romanize(text: str) -> str | None:
    settings = get_settings()
    response = httpx.post(
        f"{settings.ollama_url}/api/generate",
        json={
            "model": settings.summary_model,
            "prompt": _PROMPT.format(text=text),
            "stream": False,
            "options": {"temperature": 0.1},
        },
        timeout=180.0,
    )
    response.raise_for_status()
    return response.json().get("response", "").strip() or None


def romanize_transcript(text: str, *, use_llm: bool = True) -> str:
    """Return the transcript with no Tamil/Devanagari letters.

    English (or any already-Latin) transcript is returned untouched. Otherwise the
    model romanizes it; if that is unavailable or imperfect, mechanical
    transliteration is used so the result never keeps Indic script.
    """
    if not has_indic_letters(text):
        return text

    if use_llm and len(text) <= _LLM_MAX_CHARS:
        try:
            candidate = _llm_romanize(text)
            if (
                candidate
                and not has_indic_letters(candidate)
                and _plausible(text, candidate)
            ):
                return candidate
            logger.warning("LLM romanization rejected; using mechanical fallback")
        except Exception:
            logger.warning("LLM romanization unavailable; using mechanical fallback",
                           exc_info=True)

    try:
        return _mechanical(text)
    except Exception:
        # Never fail the pipeline over romanization — worst case the transcript
        # keeps its original script, which is still a faithful record.
        logger.warning("Mechanical romanization failed; keeping original script",
                       exc_info=True)
        return text
