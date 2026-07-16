"""Chunking rules for the patient-memory index (pure logic, no model load)."""

from app.models.schemas import SoapNote
from app.services.embeddings import _MAX_CHUNK_CHARS, chunk_note


def _note(**overrides: str) -> SoapNote:
    base = {
        "subjective": "Client reports feeling anxious at work.",
        "objective": "Affect congruent; speech normal rate.",
        "assessment": "Symptoms consistent with generalized anxiety.",
        "plan": "Practice breathing exercises daily.",
    }
    return SoapNote(**{**base, **overrides})


def test_chunks_carry_section_labels() -> None:
    chunks = chunk_note(_note())
    assert len(chunks) == 4
    assert chunks[0].startswith("Subjective: ")
    assert chunks[3].startswith("Plan: ")


def test_empty_sections_are_skipped() -> None:
    chunks = chunk_note(_note(objective="", plan="   "))
    assert len(chunks) == 2
    assert all(c.startswith(("Subjective:", "Assessment:")) for c in chunks)


def test_long_sections_split_within_budget() -> None:
    long_body = ("The client described recurring worries. " * 60).strip()
    chunks = chunk_note(_note(subjective=long_body))
    subjective_chunks = [c for c in chunks if c.startswith("Subjective: ")]
    assert len(subjective_chunks) > 1
    assert all(len(c) <= _MAX_CHUNK_CHARS + 1 for c in subjective_chunks)
    # No content lost: recombined text covers the original words.
    recombined = " ".join(c.removeprefix("Subjective: ") for c in subjective_chunks)
    assert recombined.count("recurring worries") == long_body.count("recurring worries")
