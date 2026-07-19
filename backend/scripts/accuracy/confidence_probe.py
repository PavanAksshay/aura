"""Does Whisper's own confidence signal flag the hallucinated passage?

ANSWER, MEASURED: no. See README.md — the hallucinated segment landed at the
median and the worst-scoring segments were all correct. Kept so the result can
be re-derived after a model change rather than re-argued from intuition.

The noisy-audio run produced fluent nonsense ("closed a movie, Sahasran
Questiony, a freaky rendering") where the speech was "Twice last year". If
avg_logprob / no_speech_prob separate that segment from the honest ones, a
confidence warning is worth building. If they don't, building it would be
security theatre — so measure before shipping.

Also times distil-large-v3 on the same audio, since 4.2x realtime means a
50-minute session takes 3.5 hours.
"""

import pathlib
import sys
import time

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2]))

AUDIO = pathlib.Path(__file__).parent / "out" / "noisy_session.webm"
# The hallucinated span, and a control phrase Whisper got right.
HALLUCINATED = "sahasran"
INVERTED = "won't help"


def run(model_name: str, compute: str = "int8") -> None:
    from faster_whisper import WhisperModel
    from faster_whisper.audio import decode_audio
    import numpy as np

    print(f"\n{'=' * 74}\n{model_name} ({compute})\n{'=' * 74}")
    audio = np.asarray(decode_audio(str(AUDIO), sampling_rate=16000))

    started = time.time()
    model = WhisperModel(model_name, device="cpu", compute_type=compute)
    load_s = time.time() - started

    started = time.time()
    segments, info = model.transcribe(audio, beam_size=5, vad_filter=True)
    rows = []
    for s in segments:
        rows.append(
            {
                "start": s.start,
                "end": s.end,
                "text": s.text.strip(),
                "avg_logprob": s.avg_logprob,
                "no_speech_prob": s.no_speech_prob,
                "compression_ratio": s.compression_ratio,
            }
        )
    elapsed = time.time() - started
    dur = getattr(info, "duration", 103.0)
    print(f"load {load_s:.0f}s | transcribe {elapsed:.0f}s | {elapsed / dur:.1f}x realtime")

    logprobs = [r["avg_logprob"] for r in rows]
    print(f"\navg_logprob across {len(rows)} segments: "
          f"min {min(logprobs):.3f} / median {sorted(logprobs)[len(logprobs)//2]:.3f} "
          f"/ max {max(logprobs):.3f}")

    print("\nper-segment (worst logprob first):")
    for r in sorted(rows, key=lambda r: r["avg_logprob"])[:6]:
        flag = ""
        if HALLUCINATED in r["text"].lower():
            flag = "  <-- HALLUCINATED SPAN"
        elif INVERTED in r["text"].lower():
            flag = "  <-- MEANING-INVERTED SPAN"
        print(f"  logprob {r['avg_logprob']:+.3f} | no_speech {r['no_speech_prob']:.3f} "
              f"| cr {r['compression_ratio']:.2f} | {r['text'][:60]!r}{flag}")

    hall = [r for r in rows if HALLUCINATED in r["text"].lower()]
    if hall:
        h = hall[0]
        rank = sorted(logprobs).index(h["avg_logprob"]) + 1
        print(f"\nHallucinated segment ranks {rank}/{len(rows)} by avg_logprob "
              f"({h['avg_logprob']:+.3f}).")
        print("  → A confidence threshold WOULD catch it."
              if rank <= 3 else
              "  → A confidence threshold would NOT reliably catch it.")
    else:
        print("\n(hallucination did not reproduce this run — decoding is not deterministic)")


if __name__ == "__main__":
    run("large-v3")
