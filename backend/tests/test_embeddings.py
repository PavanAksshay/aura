"""Chunking rules for the patient-memory index (pure logic, no model load)."""

from app.models.schemas import SessionNote
from app.services.embeddings import _MAX_CHUNK_CHARS, chunk_note


def _note(**overrides: list[str]) -> SessionNote:
    base: dict[str, list[str]] = {
        "discussed": [
            "Client reports feeling anxious at work.",
            "Sleeping four to five hours a night.",
        ],
        "ahead": ["Practice breathing exercises daily."],
    }
    return SessionNote(**{**base, **overrides})


def test_one_chunk_per_bullet_with_labels() -> None:
    chunks = chunk_note(_note())
    assert len(chunks) == 3
    assert chunks[0].startswith("Discussed: ")
    assert chunks[2].startswith("Ahead: ")


def test_empty_sections_are_skipped() -> None:
    chunks = chunk_note(_note(ahead=[]))
    assert len(chunks) == 2
    assert all(c.startswith("Discussed:") for c in chunks)


def test_blank_bullets_are_skipped() -> None:
    chunks = chunk_note(_note(discussed=["Real content.", "   "], ahead=[]))
    assert len(chunks) == 1


def test_long_bullets_split_within_budget() -> None:
    long_body = ("The client described recurring worries. " * 60).strip()
    chunks = chunk_note(_note(discussed=[long_body], ahead=[]))
    assert len(chunks) > 1
    assert all(len(c) <= _MAX_CHUNK_CHARS + 1 for c in chunks)
    # No content lost: recombined text covers the original words.
    recombined = " ".join(c.removeprefix("Discussed: ") for c in chunks)
    assert recombined.count("recurring worries") == long_body.count("recurring worries")
