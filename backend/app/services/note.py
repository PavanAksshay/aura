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
import math
import re
from typing import Any

import httpx

from app.core.config import get_settings
from app.models.schemas import SessionNote

logger = logging.getLogger(__name__)

_PROMPT = """You are a clinical documentation assistant for a psychologist. \
From the therapy session transcript below, produce a STRICT JSON object with \
exactly these keys:
- "discussed": bullet strings summarizing what was actually discussed — \
symptoms, experiences, feelings, and anything clinically relevant the patient \
reported. Plain clinical language, third person, no speaker labels.
- "ahead": bullet strings covering what lies ahead. Include EVERY forward- \
looking thing the transcript states: anything suggested, agreed, or planned, \
homework, routines or techniques to try, and any topic named for a future \
session. Phrases like "let's try", "this week", "before bed", "next session" \
signal these — capture them.

RULES — these override everything else:
1. Write ONLY what the transcript states. Never infer, embellish, or add \
typical therapy content that is not there. This note goes into a patient's \
clinical record, so an invented bullet is a serious error.
2. Equally, do not omit something the transcript does state — a plan that was \
agreed out loud belongs in "ahead".
3. There is NO minimum number of bullets. Write as many as the transcript \
supports and no more — at most 8 for "discussed" and 5 for "ahead".
4. Use empty lists only when the transcript genuinely offers nothing: no \
clinical content at all, or no plan of any kind. If the recording is not a \
therapy session, return {{"discussed": [], "ahead": []}}.
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


# --- Grounding guard -------------------------------------------------------
# A 3B model told to summarize a therapy session will happily invent a
# textbook one when the transcript has nothing clinical in it — real observed
# failure: a transcript of someone reading the app's own marketing copy
# produced "Patient reports feeling overwhelmed by work responsibilities",
# "symptoms of anxiety and depression", "difficulty sleeping". None of it was
# said. Fabricated symptoms in a patient's record are the worst thing this
# app could do, so every bullet is checked against the transcript's own words
# and dropped if it shares almost none of them.

_WORD = re.compile(r"[a-z]+")
# Function words plus note boilerplate ("patient reports …", "during the
# session …") — phrasing the model adds that is never spoken aloud, so it
# should neither prove nor disprove that a bullet is grounded.
_IGNORED_WORDS = frozenset(
    """a an and are as at be been being but by for from had has have he her his
    him i in into is it its me my of on or our she that the their them they this
    to was we were what when which who will with you your
    patient client therapist session discussed discussion reports reported
    reporting expresses expressed expressing describes described feeling feels
    felt states stated mentions mentioned notes noted explores explored
    exploring during about""".split()
)
# Share of a bullet's content words that must also appear in the transcript.
# Tuned against real output: observed fabrications scored 0.0 (not one word in
# common), while honest paraphrase — "has withdrawn from previous exercise
# routine" for "I've stopped going to the gym" — scored as low as 0.25. The
# threshold sits below that, because wrongly deleting real clinical content is
# as harmful as keeping invented content. This is a guard against wholesale
# confabulation, not a fact-checker: it cannot catch a bullet that borrows the
# transcript's words but distorts their meaning.
_GROUNDING_THRESHOLD = 0.2


def _content_words(text: str) -> set[str]:
    """Meaning-bearing word stems, so plurals/tenses still match ("sleeping"↔"sleep")."""
    return {
        _stem(word)
        for word in _WORD.findall(text.lower())
        if len(word) > 2 and word not in _IGNORED_WORDS
    }


def _stem(word: str) -> str:
    for suffix in ("ing", "ed", "es", "s"):
        if word.endswith(suffix) and len(word) - len(suffix) >= 4:
            return word[: -len(suffix)]
    return word


# Second chance for bullets with no shared vocabulary: honest paraphrase can
# legitimately share no words at all ("stopped going to the gym" → "withdrawn
# from a previous exercise routine"), and deleting real clinical content is its
# own kind of harm. Cosine against the transcript's own sentences catches that.
#
# Measured separation on real output is real but narrow — fabricated bullets
# scored 0.45-0.53 against an unrelated transcript, honest paraphrase 0.70-0.89
# against its own — so this threshold sits in the gap. It is only a rescue
# path, never a rejection path: embeddings cannot tell an invented bullet from
# a true one when both are plausible therapy language (measured: fabricated
# bullets score 0.53-0.68 against a genuine therapy transcript).
_SIMILARITY_THRESHOLD = 0.65


def _cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b, strict=True))
    norm = math.sqrt(sum(x * x for x in a)) * math.sqrt(sum(y * y for y in b))
    return dot / norm if norm else 0.0


def _similar_to_transcript(bullets: list[str], transcript: str) -> dict[str, float]:
    """Best cosine between each bullet and any sentence actually spoken."""
    sentences = [s.strip() for s in _SENTENCE_SPLIT.split(transcript) if len(s.strip()) > 12]
    if not sentences or not bullets:
        return {}
    try:
        from app.services.embeddings import embed_documents

        spoken = embed_documents(sentences)
        return {
            bullet: max(_cosine(vector, s) for s in spoken)
            for bullet, vector in zip(bullets, embed_documents(bullets), strict=True)
        }
    except Exception:
        # Embeddings unavailable — fall back to lexical-only grounding rather
        # than failing the note.
        logger.warning("Similarity grounding unavailable", exc_info=True)
        return {}


def _grounded(bullets: list[str], transcript: str) -> list[str]:
    """Drop bullets that neither share the transcript's words nor its meaning."""
    spoken = _content_words(transcript)
    if not spoken:
        return []

    kept: list[str] = []
    unanchored: list[str] = []
    for bullet in bullets:
        words = _content_words(bullet)
        # No content words at all — nothing to verify against, so don't keep it.
        if not words:
            continue
        if len(words & spoken) / len(words) >= _GROUNDING_THRESHOLD:
            kept.append(bullet)
        else:
            unanchored.append(bullet)

    similarity = _similar_to_transcript(unanchored, transcript)
    for bullet in unanchored:
        score = similarity.get(bullet, 0.0)
        if score >= _SIMILARITY_THRESHOLD:
            kept.append(bullet)
        else:
            logger.warning("Dropped ungrounded note bullet (similarity %.2f): %r", score, bullet)
    # Restore the model's ordering; the two passes above interleave it.
    return [b for b in bullets if b in kept]


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
        # Every bullet must be traceable to the transcript before it reaches a
        # clinical record; an empty note is the correct output for a recording
        # with no clinical content, so it is returned as-is rather than
        # triggering the fallback (which would only re-inject raw transcript).
        return SessionNote(
            discussed=_grounded(_clean_bullets(data.get("discussed"), _MAX_DISCUSSED), transcript),
            ahead=_grounded(_clean_bullets(data.get("ahead"), _MAX_AHEAD), transcript),
        )
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
        t for key in ("subjective", "objective", "assessment") if (t := keep(raw.get(key)))
    ]
    ahead = [t] if (t := keep(raw.get("plan"))) else []
    return SessionNote(discussed=discussed, ahead=ahead)
