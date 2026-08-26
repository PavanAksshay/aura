"""Speaker diarization via pyannote.audio — an OPTIONAL enhancement.

Diarization answers "who spoke when": it segments the audio into speaker turns
so the transcript can be labelled (Speaker 1 / Speaker 2 / …). It runs fully
locally — on Apple's MPS GPU when available (much faster there than on CPU),
otherwise on CPU.

It is deliberately best-effort. Every failure mode — the extra deps not being
installed, `enable_diarization` off, no Hugging Face token, the gated model not
yet accepted on the caller's HF account, or any runtime error — degrades to
`None`, and the caller keeps the plain transcript. Diarization never breaks a
recording.

The pyannote pipeline (torch + the segmentation/embedding models) is heavy to
load, so it is instantiated once and shared behind a lock, mirroring the
Whisper model in transcription.py.
"""

from __future__ import annotations

import logging
import os
import threading
from dataclasses import dataclass
from typing import Any

import numpy as np

from app.core.config import get_settings

# Let any op that MPS doesn't implement fall back to CPU rather than erroring.
# Must be set before torch runs its first MPS op; harmless when MPS is unused.
os.environ.setdefault("PYTORCH_ENABLE_MPS_FALLBACK", "1")

logger = logging.getLogger(__name__)

_pipeline_lock = threading.Lock()
_pipeline: Any = None
# Once loading has failed we stop retrying: a missing dep or an unaccepted
# gate will not fix itself mid-process, and re-importing torch per request is
# wasteful. Reset only by restarting the service.
_load_failed = False


@dataclass(frozen=True)
class SpeakerTurn:
    """A contiguous span attributed to one speaker, in seconds."""

    start: float
    end: float
    speaker: str


def _select_device(preferred: str) -> str:
    """Pick a torch device for pyannote: the configured one, or auto (CUDA/MPS/CPU)."""
    pref = preferred.strip().lower()
    if pref:
        return pref
    try:
        import torch

        if torch.cuda.is_available():
            return "cuda"
        if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
            return "mps"
    except Exception:
        logger.debug("Device probe failed; falling back to CPU", exc_info=True)
    return "cpu"


def _load_pipeline() -> Any:
    """Instantiate the pyannote pipeline once, or return None on any failure."""
    global _pipeline, _load_failed
    with _pipeline_lock:
        if _pipeline is not None:
            return _pipeline
        if _load_failed:
            return None

        settings = get_settings()
        if not settings.enable_diarization:
            _load_failed = True
            return None
        if not settings.hf_token:
            logger.info(
                "Diarization enabled but HF_TOKEN is unset — skipping speaker "
                "labels. Set HF_TOKEN to a Hugging Face account that has "
                "accepted the pyannote model conditions to enable it."
            )
            _load_failed = True
            return None

        try:
            # Imported lazily: torch/pyannote are a large optional dependency.
            from pyannote.audio import Pipeline

            pipeline = Pipeline.from_pretrained(
                settings.diarization_model,
                token=settings.hf_token,
            )
            if pipeline is None:
                # from_pretrained returns None (rather than raising) when the
                # token can't access the gated model — the usual "not accepted
                # the conditions yet" case.
                raise RuntimeError(
                    "pyannote returned no pipeline — the HF token likely hasn't "
                    "accepted the gated model conditions."
                )
            # Move the pipeline onto the GPU (MPS on Apple) when available; this
            # is the difference between sub-realtime and tens of minutes here.
            device = _select_device(settings.diarization_device)
            if device != "cpu":
                try:
                    import torch

                    pipeline.to(torch.device(device))
                except Exception:
                    logger.warning(
                        "Could not move diarization to %s; staying on CPU.",
                        device, exc_info=True,
                    )
                    device = "cpu"
            _pipeline = pipeline
            logger.info(
                "Loaded diarization pipeline %s on %s",
                settings.diarization_model, device,
            )
            return _pipeline
        except Exception:
            logger.warning(
                "Could not load the diarization pipeline; transcripts will not "
                "be speaker-labelled. This is non-fatal.",
                exc_info=True,
            )
            _load_failed = True
            return None


def diarize(audio: np.ndarray, sample_rate: int) -> list[SpeakerTurn] | None:
    """Return speaker turns for a mono waveform, or None if unavailable.

    `audio` is a 1-D float32 array (the same array decoded for Whisper); it is
    wrapped as an in-memory (channel, sample) tensor so pyannote never has to
    re-decode the original browser webm/opus — which torchaudio can't load
    without ffmpeg.
    """
    pipeline = _load_pipeline()
    if pipeline is None:
        return None

    try:
        import torch

        waveform = torch.from_numpy(np.ascontiguousarray(audio, dtype=np.float32))
        # pyannote expects shape (channel, sample).
        result = pipeline(
            {"waveform": waveform.unsqueeze(0), "sample_rate": sample_rate}
        )
        # pyannote 4.x returns a DiarizeOutput whose `.speaker_diarization` is
        # the pyannote.core Annotation; 3.x returned the Annotation directly.
        annotation = getattr(result, "speaker_diarization", result)
        turns = [
            SpeakerTurn(start=float(segment.start), end=float(segment.end), speaker=str(speaker))
            for segment, _, speaker in annotation.itertracks(yield_label=True)
        ]
        turns.sort(key=lambda t: t.start)
        logger.info(
            "Diarized into %d turns across %d speakers",
            len(turns),
            len({t.speaker for t in turns}),
        )
        return turns
    except Exception:
        logger.warning("Diarization failed at inference; falling back.", exc_info=True)
        return None
