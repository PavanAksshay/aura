"""Note structuring: the grounding guard, heuristic fallback, legacy-SOAP shim."""

from app.services.note import _grounded, _heuristic_note, parse_note

TRANSCRIPT = (
    "Speaker 1: How has your week been? "
    "Speaker 2: I have been feeling really anxious at work and I cannot sleep. "
    "Speaker 2: My biggest fear is failing in front of everyone. "
    "Speaker 1: For next week, practice the breathing exercise daily. "
    "Speaker 1: We will focus on that fear in our next session."
)

REAL_TRANSCRIPT = (
    "Therapist: How have you been sleeping? "
    "Patient: Badly. I lie awake until three, maybe four hours a night. "
    "My mind races about work and the deadline. "
    "Patient: I have stopped going to the gym too."
)


# Regression: a recording of the app's own marketing copy — no clinical
# content whatsoever — made llama3.2:3b invent a textbook therapy note. These
# are the exact bullets it produced. None may survive into a patient record.
FABRICATED = [
    "Patient reports feeling overwhelmed by work responsibilities",
    "Discussing symptoms of anxiety and depression",
    "Patient expresses difficulty sleeping due to racing thoughts",
    "Exploring coping mechanisms for stress management",
]
NON_CLINICAL = (
    "Therapist: record capture the session audio a live waveform confirms aura "
    "is listening the session is transcribed privately on your own machine "
    "with each speaker labeled then turn into a clear note"
)


def test_grounding_drops_fabricated_bullets() -> None:
    assert _grounded(FABRICATED, NON_CLINICAL) == []


def test_grounding_keeps_honest_paraphrase() -> None:
    """Paraphrase loses the transcript's exact wording and must still survive."""
    bullets = [
        "Patient reports poor sleep, roughly four hours a night",
        "Describes racing thoughts about work deadlines",
        # "stopped going to the gym" → a legitimate rewording that shares only
        # one content word with the transcript.
        "Has withdrawn from a previous exercise routine",
    ]
    assert _grounded(bullets, REAL_TRANSCRIPT) == bullets


def test_grounding_on_empty_transcript_keeps_nothing() -> None:
    assert _grounded(FABRICATED, "") == []


def test_heuristic_splits_discussed_and_ahead() -> None:
    note = _heuristic_note(TRANSCRIPT)
    assert any("anxious" in b for b in note.discussed)
    assert any("breathing exercise" in b for b in note.ahead)


def test_heuristic_strips_speaker_labels() -> None:
    note = _heuristic_note(TRANSCRIPT)
    assert all("Speaker" not in b for b in note.discussed + note.ahead)


def test_heuristic_on_empty_transcript_is_empty() -> None:
    note = _heuristic_note("")
    assert note.discussed == []
    assert note.ahead == []


def test_parse_note_reads_new_shape() -> None:
    note = parse_note({"discussed": ["Reported poor sleep"], "ahead": ["Fixed bedtime"]})
    assert note.discussed == ["Reported poor sleep"]
    assert note.ahead == ["Fixed bedtime"]


def test_parse_note_folds_legacy_soap() -> None:
    note = parse_note(
        {
            "subjective": "Reports anxiety at work.",
            "objective": "Appeared tearful.",
            "assessment": "Consistent with generalized anxiety.",
            "plan": "Practice breathing daily.",
        }
    )
    assert note.discussed == [
        "Reports anxiety at work.",
        "Appeared tearful.",
        "Consistent with generalized anxiety.",
    ]
    assert note.ahead == ["Practice breathing daily."]


def test_parse_note_drops_legacy_placeholders() -> None:
    note = parse_note(
        {
            "subjective": "Reports anxiety at work.",
            "objective": "No observable/behavioral content identified.",
            "assessment": "No assessment content identified.",
            "plan": "No plan content identified.",
        }
    )
    assert note.discussed == ["Reports anxiety at work."]
    assert note.ahead == []


def test_parse_note_tolerates_junk() -> None:
    note = parse_note({"discussed": "not a list", "ahead": None})
    assert note.discussed == []
    assert note.ahead == []
