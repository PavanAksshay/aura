"""On-demand transcript summarization.

Preferred path: a local Ollama model produces a structured summary (patient
details + a narrative of what was discussed) — entirely on-device, so the
transcript never leaves the machine. If Ollama is unreachable or its model
isn't pulled, we fall back to a deterministic heuristic so the feature always
returns something useful.
"""

import json
import logging
import re

import httpx

from app.core.config import get_settings
from app.models.schemas import SessionSummary

logger = logging.getLogger(__name__)

_PROMPT = """You are a clinical documentation assistant for a psychologist.
From the therapy session transcript below, produce a STRICT JSON object with \
exactly these keys:
- "patient_name": the patient's name if stated in the transcript, else ""
- "age": the patient's age if stated, else ""
- "personal_details": other personal details mentioned (occupation, family, \
living situation, location), as a short phrase, else ""
- "discussion": a 3-5 sentence summary of what the therapist and patient \
discussed, in plain clinical language.
Return ONLY the JSON object, no prose.

Transcript:
\"\"\"{transcript}\"\"\"
"""

# Cap transcript length fed to the model to keep latency + context bounded.
_MAX_CHARS = 6000


def _heuristic_summary(transcript: str) -> SessionSummary:
    """No-LLM fallback: regex out an age and take the opening sentences."""
    age = ""
    age_match = re.search(
        r"\b(\d{1,2})\s*(?:years?\s*old|y/?o)\b", transcript, re.IGNORECASE
    ) or re.search(r"\bage\s*(?:is|:)?\s*(\d{1,2})\b", transcript, re.IGNORECASE)
    if age_match:
        age = age_match.group(1)

    sentences = re.split(r"(?<=[.!?])\s+", transcript.strip())
    discussion = " ".join(sentences[:4]).strip() or transcript[:400]
    return SessionSummary(age=age, discussion=discussion, engine="heuristic")


def generate_summary(transcript: str) -> SessionSummary:
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
        return SessionSummary(
            patient_name=str(data.get("patient_name", "") or ""),
            age=str(data.get("age", "") or ""),
            personal_details=str(data.get("personal_details", "") or ""),
            discussion=str(data.get("discussion", "") or ""),
            engine="ollama",
        )
    except Exception:
        logger.warning(
            "Ollama summary unavailable — falling back to heuristic", exc_info=True
        )
        return _heuristic_summary(transcript)
