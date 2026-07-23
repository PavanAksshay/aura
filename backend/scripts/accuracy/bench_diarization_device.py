"""Measure pyannote diarization on CPU vs MPS (Apple GPU) for the same clip.

The pipeline currently runs on CPU. On an M1 the torch-based pyannote models can
run on MPS; this quantifies whether that fixes the ~33x-realtime diarization
cost measured on the 8 GB machine. Writes results incrementally so an
interrupted run keeps what it has.
"""

from __future__ import annotations

import json
import os
import time
from pathlib import Path

# Let unsupported MPS ops fall back to CPU rather than erroring.
os.environ.setdefault("PYTORCH_ENABLE_MPS_FALLBACK", "1")

import numpy as np
import torch

from app.core.config import get_settings
from app.services.transcription import _SAMPLE_RATE, _decode

HERE = Path(__file__).parent
AUDIO = HERE / "out" / "tanglish_session.webm"
RESULT = HERE / "bench_diarization_result.json"


def run(pipeline, waveform, device: str) -> dict:
    pipeline.to(torch.device(device))
    t0 = time.perf_counter()
    out = pipeline({"waveform": waveform, "sample_rate": _SAMPLE_RATE})
    elapsed = time.perf_counter() - t0
    ann = getattr(out, "speaker_diarization", out)
    speakers = {str(s) for _, _, s in ann.itertracks(yield_label=True)}
    return {"device": device, "seconds": round(elapsed, 1), "speakers": len(speakers)}


def main() -> None:
    from pyannote.audio import Pipeline

    audio = _decode(AUDIO)
    duration = len(audio) / _SAMPLE_RATE
    waveform = torch.from_numpy(np.ascontiguousarray(audio, dtype=np.float32)).unsqueeze(0)

    settings = get_settings()
    pipeline = Pipeline.from_pretrained(settings.diarization_model, token=settings.hf_token)

    results: dict = {"model": settings.diarization_model, "audio_seconds": round(duration, 1)}
    RESULT.write_text(json.dumps(results, indent=2))

    for device in ("mps", "cpu"):
        try:
            r = run(pipeline, waveform, device)
            r["realtime_x"] = round(r["seconds"] / duration, 1)
            results[device] = r
            print(f"{device}: {r['seconds']}s ({r['realtime_x']}x realtime), "
                  f"{r['speakers']} speakers")
        except Exception as exc:  # pragma: no cover - operational
            results[device] = {"error": str(exc)}
            print(f"{device}: ERROR {exc}")
        RESULT.write_text(json.dumps(results, indent=2))

    print(f"Wrote {RESULT}")


if __name__ == "__main__":
    main()
