"""Note structuring: the heuristic fallback and the legacy-SOAP shim."""

from app.services.note import _heuristic_note, parse_note

TRANSCRIPT = (
    "Speaker 1: How has your week been? "
    "Speaker 2: I have been feeling really anxious at work and I cannot sleep. "
    "Speaker 2: My biggest fear is failing in front of everyone. "
    "Speaker 1: For next week, practice the breathing exercise daily. "
    "Speaker 1: We will focus on that fear in our next session."
)


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
