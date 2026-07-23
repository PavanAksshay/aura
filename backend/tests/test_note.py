"""Note structuring: the grounding guard, heuristic fallback, legacy-SOAP shim."""

from app.services.note import (
    _grounded,
    _heuristic_note,
    _is_multilingual,
    parse_note,
)

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


# Whisper writes non-English speech in its own script, so a Tamil or Hindi
# session lands as non-Latin text. The summary is always English, which means
# the English grounding guard can't run on it — _is_multilingual is what steers
# build_session_note past the guard, so it must recognise these correctly.
def test_multilingual_detects_tamil_and_hindi() -> None:
    assert _is_multilingual("எனக்கு தூக்கம் வரவில்லை. மிகவும் கவலையாக இருக்கிறேன்.")
    assert _is_multilingual("मुझे बहुत चिंता हो रही है और मैं सो नहीं पाता।")
    # Code-switched (Hindi script + English words) still reads as non-English.
    assert _is_multilingual("Mujhe बहुत तनाव हो रहा है because of work.")


def test_multilingual_leaves_english_alone() -> None:
    assert not _is_multilingual(
        "The patient reported feeling anxious about work and poor sleep."
    )
    # Accented Latin names are still English — they must not trip the guard off.
    assert not _is_multilingual("José and café owner Renée discussed the séance.")
    assert not _is_multilingual("")


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
