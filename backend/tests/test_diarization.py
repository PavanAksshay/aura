"""Speaker merge logic + diarization's best-effort contract.

The live pyannote pipeline needs network + a gated model, so these tests cover
the deterministic, offline parts: mapping speaker turns onto transcript
segments, and the guarantee that any diarization failure degrades to a plain
transcript rather than raising.
"""

from pathlib import Path

import numpy as np
import pytest

from app.services.diarization import SpeakerTurn
from app.services.transcription import (
    TranscriptSegment,
    _dominant_speaker,
    _merge_speakers,
)


def _seg(start: float, end: float, text: str) -> TranscriptSegment:
    return TranscriptSegment(start=start, end=end, text=text)


def test_dominant_speaker_picks_max_overlap() -> None:
    turns = [
        SpeakerTurn(0.0, 5.0, "SPEAKER_00"),
        SpeakerTurn(5.0, 10.0, "SPEAKER_01"),
    ]
    # Segment 4-9 overlaps SPEAKER_00 for 1s and SPEAKER_01 for 4s.
    assert _dominant_speaker(_seg(4.0, 9.0, "x"), turns) == "SPEAKER_01"


def test_dominant_speaker_none_when_no_overlap() -> None:
    turns = [SpeakerTurn(0.0, 2.0, "SPEAKER_00")]
    assert _dominant_speaker(_seg(5.0, 6.0, "x"), turns) is None


def test_merge_labels_and_groups_consecutive() -> None:
    segments = [
        _seg(0.0, 2.0, "Hello, how are you?"),
        _seg(2.0, 4.0, "I've been anxious."),
        _seg(4.0, 6.0, "Tell me more about that."),
    ]
    turns = [
        SpeakerTurn(0.0, 2.0, "SPEAKER_00"),
        SpeakerTurn(2.0, 4.0, "SPEAKER_01"),
        SpeakerTurn(4.0, 6.0, "SPEAKER_00"),
    ]
    out = _merge_speakers(segments, turns)
    # First voice → Therapist (opens the session), second → Patient.
    assert out == (
        "Therapist: Hello, how are you?\n"
        "Patient: I've been anxious.\n"
        "Therapist: Tell me more about that."
    )


def test_merge_labels_multiple_patients() -> None:
    """1 therapist + 2 patients (couples/family): Therapist, Patient, Patient 2."""
    segments = [
        _seg(0.0, 2.0, "How are you both?"),
        _seg(2.0, 4.0, "I feel unheard."),
        _seg(4.0, 6.0, "I disagree."),
    ]
    turns = [
        SpeakerTurn(0.0, 2.0, "SPEAKER_00"),
        SpeakerTurn(2.0, 4.0, "SPEAKER_01"),
        SpeakerTurn(4.0, 6.0, "SPEAKER_02"),
    ]
    assert _merge_speakers(segments, turns) == (
        "Therapist: How are you both?\n"
        "Patient: I feel unheard.\n"
        "Patient 2: I disagree."
    )


def test_merge_neutral_labels_when_roles_off(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core.config import get_settings

    monkeypatch.setattr(get_settings(), "label_speaker_roles", False)
    segments = [_seg(0.0, 2.0, "Hi."), _seg(2.0, 4.0, "Hello.")]
    turns = [
        SpeakerTurn(0.0, 2.0, "SPEAKER_00"),
        SpeakerTurn(2.0, 4.0, "SPEAKER_01"),
    ]
    assert _merge_speakers(segments, turns) == "Speaker 1: Hi.\nSpeaker 2: Hello."


def test_merge_joins_same_speaker_run() -> None:
    segments = [
        _seg(0.0, 2.0, "One."),
        _seg(2.0, 4.0, "Two."),
    ]
    turns = [SpeakerTurn(0.0, 4.0, "SPEAKER_00")]
    assert _merge_speakers(segments, turns) == "Therapist: One. Two."


def test_merge_orphan_segment_inherits_current_speaker() -> None:
    segments = [
        _seg(0.0, 2.0, "Opening."),
        _seg(10.0, 11.0, "Gap with no turn."),  # no overlapping turn
    ]
    turns = [SpeakerTurn(0.0, 2.0, "SPEAKER_00")]
    # The orphan keeps the running speaker rather than being dropped.
    assert _merge_speakers(segments, turns) == "Therapist: Opening. Gap with no turn."


def test_transcribe_falls_back_to_plain_when_diarization_unavailable(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """If diarize() returns None, the transcript is the plain joined text."""
    import app.services.transcription as tx

    monkeypatch.setattr(tx, "_decode", lambda _p: np.zeros(16_000, dtype=np.float32))
    monkeypatch.setattr(
        tx,
        "_transcribe_segments",
        lambda _a: [_seg(0.0, 1.0, "Hello."), _seg(1.0, 2.0, "World.")],
    )
    monkeypatch.setattr(tx, "diarize", lambda _a, _sr: None)

    assert tx.transcribe_audio(Path("ignored.webm")) == "Hello. World."


def test_transcribe_labels_speakers_when_diarization_present(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import app.services.transcription as tx

    monkeypatch.setattr(tx, "_decode", lambda _p: np.zeros(16_000, dtype=np.float32))
    monkeypatch.setattr(
        tx,
        "_transcribe_segments",
        lambda _a: [_seg(0.0, 1.0, "Hi."), _seg(1.0, 2.0, "Hello back.")],
    )
    monkeypatch.setattr(
        tx,
        "diarize",
        lambda _a, _sr: [
            SpeakerTurn(0.0, 1.0, "SPEAKER_00"),
            SpeakerTurn(1.0, 2.0, "SPEAKER_01"),
        ],
    )

    out = tx.transcribe_audio(Path("ignored.webm"))
    assert out == "Therapist: Hi.\nPatient: Hello back."
