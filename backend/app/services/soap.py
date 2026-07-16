"""Transcript → SOAP note structuring.

This is deliberately a self-contained, deterministic first pass: it segments
the raw transcript into Subjective / Objective / Assessment / Plan buckets
using clinical-language cues, so the pipeline works end-to-end with no
external calls (a privacy property in itself — the transcript never leaves
this process).

It is also the designated seam for a stronger structurer: swap
`build_soap_note` for an LLM-backed implementation without touching the
route or retention logic.
"""

import re

from app.models.schemas import SoapNote

# Cue phrases that suggest which SOAP section a sentence belongs to.
# Sentences are scored by cue-match count per section (ties break by list
# order); no cue at all defaults to Subjective, since in a therapy session
# most utterances are client-reported experience.
_SECTION_CUES: list[tuple[str, re.Pattern[str]]] = [
    (
        "plan",
        re.compile(
            r"\b(next (session|week|time)|homework|assign|practice|schedule|"
            r"follow[- ]up|we('ll| will) (work on|try|focus)|goal for|plan)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "assessment",
        re.compile(
            r"\b(consistent with|suggests?|indicat\w+|progress|improv\w+|"
            r"decline|risk|diagnos\w+|symptoms? (of|have)|pattern|formulation)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "objective",
        re.compile(
            r"\b(appeared?|presents?|observed?|affect|tearful|agitated|calm|"
            r"eye contact|posture|speech (was|is)|engaged|oriented)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "subjective",
        re.compile(
            r"\b(i feel|i felt|i've been|i have been|reports?|states?|"
            r"describes?|says?|complain\w+|worried|anxious|sleep|mood)\b",
            re.IGNORECASE,
        ),
    ),
]

_SENTENCE_SPLIT = re.compile(r"(?<=[.!?])\s+")


def _classify(sentence: str) -> str:
    best_section = "subjective"
    best_score = 0
    for section, pattern in _SECTION_CUES:
        score = len(pattern.findall(sentence))
        if score > best_score:
            best_section, best_score = section, score
    return best_section


def build_soap_note(transcript: str) -> SoapNote:
    """Structure a raw session transcript into a SOAP note draft.

    The output is a *draft* for clinician review — the UI presents it as
    editable, never as a finished clinical document.
    """
    buckets: dict[str, list[str]] = {
        "subjective": [],
        "objective": [],
        "assessment": [],
        "plan": [],
    }

    for sentence in _SENTENCE_SPLIT.split(transcript.strip()):
        cleaned = sentence.strip()
        if cleaned:
            buckets[_classify(cleaned)].append(cleaned)

    def render(section: str, empty_note: str) -> str:
        return " ".join(buckets[section]) or empty_note

    return SoapNote(
        subjective=render("subjective", "No subjective content identified."),
        objective=render("objective", "No observable/behavioral content identified."),
        assessment=render("assessment", "No assessment content identified."),
        plan=render("plan", "No plan content identified."),
    )
