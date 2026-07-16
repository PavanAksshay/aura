"""SOAP structuring: sentences land in sensible sections, nothing is lost."""

from app.services.soap import build_soap_note

TRANSCRIPT = (
    "I've been feeling really anxious at work and I can't sleep. "
    "Client appeared tearful and maintained little eye contact. "
    "These symptoms suggest ongoing generalized anxiety with some progress since intake. "
    "For homework, practice the breathing exercise daily and we'll review next session."
)


def test_sections_are_populated() -> None:
    note = build_soap_note(TRANSCRIPT)
    assert "anxious" in note.subjective
    assert "tearful" in note.objective
    assert "suggest" in note.assessment
    assert "homework" in note.plan.lower()


def test_no_content_is_dropped() -> None:
    note = build_soap_note(TRANSCRIPT)
    combined = " ".join([note.subjective, note.objective, note.assessment, note.plan])
    for fragment in ["anxious", "tearful", "generalized anxiety", "breathing exercise"]:
        assert fragment in combined


def test_empty_transcript_yields_placeholders() -> None:
    note = build_soap_note("")
    assert note.subjective == "No subjective content identified."
    assert note.plan == "No plan content identified."
