"""Speech-to-text via Whisper large-v3 (faster-whisper / CTranslate2).

Fully in-process on CPU with int8 quantization: no cloud speech API, no
transcript ever leaving this machine. faster-whisper decodes browser webm/opus
directly (via PyAV) and resamples to 16 kHz mono, so no ffmpeg subprocess or
scratch conversion files are needed.

When speaker diarization is available (see diarization.py) the audio is decoded
once and the same waveform feeds both Whisper and pyannote; the resulting
speaker turns are merged onto the transcription segments to produce a
speaker-labelled transcript. Diarization is best-effort — any failure yields
the plain, unlabelled transcript instead.

Model weights (~1.5 GB for large-v3 int8) download from Hugging Face on the
first request and are cached locally afterwards.
"""

import logging
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np

from app.core.config import get_settings
from app.services.diarization import SpeakerTurn, diarize

logger = logging.getLogger(__name__)

_SAMPLE_RATE = 16_000

# The model costs ~2 GB of RAM; load once, guard with a lock, share forever.
_model_lock = threading.Lock()
_model: Any = None


@dataclass(frozen=True)
class TranscriptSegment:
    """One transcription span with its timing, in seconds."""

    start: float
    end: float
    text: str


def _get_model() -> Any:
    global _model
    with _model_lock:
        if _model is None:
            from faster_whisper import WhisperModel

            settings = get_settings()
            logger.info(
                "Loading Whisper %s (%s) — first call may download weights",
                settings.whisper_model,
                settings.whisper_compute_type,
            )
            _model = WhisperModel(
                settings.whisper_model,
                device="cpu",
                compute_type=settings.whisper_compute_type,
            )
    return _model


def _decode(audio_path: Path) -> np.ndarray:
    """Decode any browser audio to a 16 kHz mono float32 array (via PyAV)."""
    from faster_whisper.audio import decode_audio

    # decode_audio is untyped (Any); asarray pins it back to a typed ndarray.
    return np.asarray(decode_audio(str(audio_path), sampling_rate=_SAMPLE_RATE))


def _transcribe_segments(audio: np.ndarray) -> list[TranscriptSegment]:
    """Run Whisper on a decoded waveform and return timed segments."""
    model = _get_model()
    segments, info = model.transcribe(
        audio,
        beam_size=5,
        vad_filter=True,  # skip long silences — common in therapy audio
    )
    result = [
        TranscriptSegment(start=float(s.start), end=float(s.end), text=s.text.strip())
        for s in segments
        if s.text.strip()
    ]
    logger.info(
        "Transcribed %.1fs of audio (language=%s), %d segments",
        getattr(info, "duration", 0.0),
        getattr(info, "language", "?"),
        len(result),
    )
    return result


def _dominant_speaker(
    seg: TranscriptSegment, turns: list[SpeakerTurn]
) -> str | None:
    """The speaker whose turns overlap this segment the most, if any."""
    best_speaker: str | None = None
    best_overlap = 0.0
    for turn in turns:
        overlap = min(seg.end, turn.end) - max(seg.start, turn.start)
        if overlap > best_overlap:
            best_overlap = overlap
            best_speaker = turn.speaker
    return best_speaker


def _speaker_label(index: int, roles: bool) -> str:
    """Name the Nth distinct speaker (index 0-based, in order of appearance).

    With roles on, the first voice is assumed to be the therapist — they open
    the session — and everyone after is a patient (Patient, Patient 2, …). This
    is a heuristic: diarization separates *voices*, it cannot know who is who,
    so a session the patient opens would be mislabelled. Off, it's "Speaker N".
    """
    if not roles:
        return f"Speaker {index + 1}"
    if index == 0:
        return "Therapist"
    if index == 1:
        return "Patient"
    return f"Patient {index}"


def _merge_speakers(
    segments: list[TranscriptSegment], turns: list[SpeakerTurn]
) -> str:
    """Fold speaker turns onto segments as a labelled, line-per-speaker script.

    pyannote's raw labels (SPEAKER_00, …) are remapped to friendly labels in
    order of first appearance — Therapist / Patient / Patient 2 by default (see
    _speaker_label). Consecutive segments from the same speaker are joined into
    one line so a back-and-forth reads naturally. A segment with no overlapping
    turn inherits the current speaker.
    """
    roles = get_settings().label_speaker_roles
    labels: dict[str, str] = {}

    def friendly(raw: str) -> str:
        if raw not in labels:
            labels[raw] = _speaker_label(len(labels), roles)
        return labels[raw]

    lines: list[str] = []
    current: str | None = None
    buffer: list[str] = []

    def flush() -> None:
        if buffer and current is not None:
            lines.append(f"{current}: {' '.join(buffer).strip()}")
        buffer.clear()

    for seg in segments:
        raw = _dominant_speaker(seg, turns)
        label = friendly(raw) if raw is not None else current
        if label != current:
            flush()
            current = label
        buffer.append(seg.text)
    flush()

    return "\n".join(lines).strip()


def transcribe_audio(audio_path: Path) -> str:
    """Transcribe one recording to text, speaker-labelled when possible.

    Decodes the audio once and shares the waveform with diarization so the
    original file is read a single time. Deletion of `audio_path` is the
    caller's job (see retention.py); this function holds nothing after it
    returns. Falls back to a plain transcript whenever diarization is
    unavailable or produced nothing useful.
    """
    audio = _decode(audio_path)
    segments = _transcribe_segments(audio)
    if not segments:
        return ""

    turns: list[SpeakerTurn] | None = None
    if get_settings().enable_diarization:
        turns = diarize(audio, _SAMPLE_RATE)

    if turns:
        labelled = _merge_speakers(segments, turns)
        if labelled:
            return labelled

    # Plain fallback: one paragraph, matching the pre-diarization behaviour.
    return " ".join(seg.text for seg in segments).strip()
