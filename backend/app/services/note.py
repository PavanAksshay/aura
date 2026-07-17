"""Transcript → structured session note.

The note is two clean sections rather than a SOAP form:
  - "What was discussed" (`discussed`) — the session's content, as bullets.
  - "What lies ahead" (`ahead`) — agreed plans, homework, and next-session
    focus, as bullets.

Preferred path: the local Ollama model writes the bullets (plain clinical
language, no speaker labels). If Ollama is unreachable, a deterministic
fallback still produces a usable draft, so the pipeline never blocks.
`parse_note` additionally understands the legacy SOAP shape so sessions
created before this change keep rendering.
"""

import json
import logging
import re
from typing import Any

import httpx

from app.core.config import get_settings
from app.models.schemas import SessionNote

logger = logging.getLogger(__name__)

_PROMPT = """You are a clinical documentation assistant for a psychologist. \
From the therapy session transcript below, produce a STRICT JSON object with \
exactly these keys:
- "discussed": a list of 4 to 8 short bullet strings summarizing what was \
discussed — symptoms, experiences, feelings, and anything clinically relevant \
the patient reported. Plain clinical language, third person, no speaker labels.
- "ahead": a list of 2 to 5 short bullet strings covering what lies ahead — \
agreed plans, homework, routines to try, and the focus of the next session. \
If nothing was planned, return an empty list.
Return ONLY the JSON object, no prose.

Transcript:
\"\"\"{transcript}\"\"\"
"""

# Cap transcript length fed to the model to keep latency + context bounded.
_MAX_CHARS = 6000
_MAX_DISCUSSED = 8
_MAX_AHEAD = 5

_SENTENCE_SPLIT = re.compile(r"(?<=[.!?])\s+")
_SPEAKER_LABEL = re.compile(r"\bSpeaker \d+:\s*", re.IGNORECASE)
_FUTURE_CUES = re.compile(
    r"\b(next (session|week|time)|homework|for next|let'?s keep|we (will|'ll)|"
    r"going to|plan|schedule|bedtime|routine|from now on|focus of our next)\b",
    re.IGNORECASE,
)
# Legacy empty-SOAP placeholder ("No … identified.").
_LEGACY_PLACEHOLDER = re.compile(r"^no\b.*\bidentified\.?$", re.IGNORECASE)


def _clean_bullets(raw: Any, cap: int) -> list[str]:
    """Coerce a model/legacy value into a bounded list of tidy bullet strings."""
    if not isinstance(raw, list):
        return []
    bullets: list[str] = []
    for item in raw:
        # Models often prefix bullets with a marker; escapes name them
        # explicitly (hyphen, bullet, en dash).
        text = str(item).strip().lstrip("-\u2022\u2013 ").strip()
        if text and text not in bullets:
            bullets.append(text[:300])
        if len(bullets) >= cap:
            break
    return bullets


def _heuristic_note(transcript: str) -> SessionNote:
    """No-LLM fallback: future-looking sentences → ahead, the rest → discussed."""
    text = _SPEAKER_LABEL.sub("", transcript.strip())
    discussed: list[str] = []
    ahead: list[str] = []
    for sentence in _SENTENCE_SPLIT.split(text):
        cleaned = sentence.strip()
        if len(cleaned) < 12:
            continue
        if _FUTURE_CUES.search(cleaned):
            if len(ahead) < _MAX_AHEAD:
                ahead.append(cleaned)
        elif len(discussed) < _MAX_DISCUSSED:
            discussed.append(cleaned)
    return SessionNote(discussed=discussed, ahead=ahead)


def build_session_note(transcript: str) -> SessionNote:
    """Structure a transcript into the two-section note. Always returns a draft."""
    settings = get_settings()
    try:
        response = httpx.post(
            f"{settings.ollama_url}/api/generate",
            json={
                "model": settings.summary_model,
                "prompt": _PROMPT.format(transcript=transcript[:_MAX_CHARS]),
                "stream": False,
                "format": "json",
                "options": {"temperature": 0.2},
            },
            timeout=180.0,
        )
        response.raise_for_status()
        data = json.loads(response.json().get("response", "{}"))
        note = SessionNote(
            discussed=_clean_bullets(data.get("discussed"), _MAX_DISCUSSED),
            ahead=_clean_bullets(data.get("ahead"), _MAX_AHEAD),
        )
        if note.discussed:
            return note
        logger.warning("Ollama note came back empty — using heuristic")
    except Exception:
        logger.warning(
            "Ollama note structuring unavailable — falling back to heuristic",
            exc_info=True,
        )
    return _heuristic_note(transcript)


def parse_note(raw: dict[str, Any]) -> SessionNote:
    """Read a stored note in either shape: new {discussed, ahead} or legacy SOAP."""
    if "discussed" in raw or "ahead" in raw:
        return SessionNote(
            discussed=_clean_bullets(raw.get("discussed"), _MAX_DISCUSSED),
            ahead=_clean_bullets(raw.get("ahead"), _MAX_AHEAD),
        )

    # Legacy SOAP: fold S/O/A into "discussed", plan into "ahead", dropping
    # the "No … identified." placeholders.
    def keep(value: Any) -> str | None:
        text = str(value or "").strip()
        return text if text and not _LEGACY_PLACEHOLDER.match(text) else None

    discussed = [
        t
        for key in ("subjective", "objective", "assessment")
        if (t := keep(raw.get(key)))
    ]
    ahead = [t] if (t := keep(raw.get("plan"))) else []
    return SessionNote(discussed=discussed, ahead=ahead)
