"""Benchmark summary models on a non-English (Tamil/English) therapy transcript.

Runs the *real* production prompt (app.services.note._PROMPT) against each model
through Ollama, timing the call and printing the English summary it produces, so
the choice of summary model can be made on evidence rather than reputation.

Usage:
    .venv/bin/python scripts/accuracy/bench_summary_models.py

The transcript is Tamil script heavily code-switched with English — i.e. what
Whisper large-v3 actually emits for a Tamil session — so it exercises the exact
thing we care about: can the model understand the other language and answer in
clean English?
"""

from __future__ import annotations

import json
import statistics
import sys
import time
from pathlib import Path

import httpx

# Import the live prompt so this measures what the app really sends.
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from app.services.note import _MAX_CHARS, _PROMPT  # noqa: E402

OLLAMA = "http://localhost:11434"
# qwen2.5:7b deliberately excluded: at 4.7 GB it pushes an 8 GB M1 into memory
# panics (it restarted the machine mid-run). Both models below are ~2 GB — the
# same footprint the app already loads for every session — so this is safe.
MODELS = ["llama3.2:3b", "qwen2.5:3b"]
SAMPLE = Path(__file__).with_name("tamil_sample.txt")
RUNS = 2  # per model, after a warm-up call, to smooth first-token variance


def summarize(model: str, transcript: str) -> tuple[dict, float]:
    """One production-shaped summary call. Returns (parsed_json, seconds)."""
    started = time.perf_counter()
    resp = httpx.post(
        f"{OLLAMA}/api/generate",
        json={
            "model": model,
            "prompt": _PROMPT.format(transcript=transcript[:_MAX_CHARS]),
            "stream": False,
            "format": "json",
            "options": {"temperature": 0.2},
        },
        timeout=600.0,
    )
    resp.raise_for_status()
    elapsed = time.perf_counter() - started
    body = resp.json()
    try:
        parsed = json.loads(body.get("response", "{}"))
    except json.JSONDecodeError:
        parsed = {"_unparseable": body.get("response", "")}
    return parsed, elapsed


def is_english(text: str) -> bool:
    """True if a bullet is written in the Latin alphabet (i.e. actually English)."""
    letters = [c for c in text if c.isalpha()]
    if not letters:
        return False
    foreign = sum(1 for c in letters if ord(c) > 0x024F)
    return foreign / len(letters) < 0.10


def main() -> None:
    transcript = SAMPLE.read_text(encoding="utf-8")
    print(f"Transcript: {len(transcript)} chars, "
          f"{sum(1 for c in transcript if ord(c) > 0x0B00)} Tamil-range letters\n")

    results = []
    for model in MODELS:
        print(f"=== {model} ===")
        try:
            # Warm-up (loads weights into RAM; not timed).
            summarize(model, transcript)
        except Exception as exc:  # pragma: no cover - operational
            print(f"  SKIP — could not run ({exc})\n")
            continue

        timings = []
        last = {}
        for _ in range(RUNS):
            last, elapsed = summarize(model, transcript)
            timings.append(elapsed)

        discussed = last.get("discussed", []) or []
        ahead = last.get("ahead", []) or []
        all_bullets = [str(b) for b in discussed + ahead]
        english = sum(is_english(b) for b in all_bullets)
        median = statistics.median(timings)

        print(f"  time (median of {RUNS}): {median:.1f}s   [{', '.join(f'{t:.1f}' for t in timings)}]")
        print(f"  bullets: {len(discussed)} discussed + {len(ahead)} ahead; "
              f"{english}/{len(all_bullets)} in English")
        print("  DISCUSSED:")
        for b in discussed:
            print(f"    - {b}")
        print("  AHEAD:")
        for b in ahead:
            print(f"    - {b}")
        print()

        results.append({
            "model": model,
            "median_s": round(median, 1),
            "timings_s": [round(t, 1) for t in timings],
            "discussed": discussed,
            "ahead": ahead,
            "english_bullets": f"{english}/{len(all_bullets)}",
        })
        # Persist after every model so an interrupted run keeps what it has.
        out = SAMPLE.with_name("bench_summary_result.json")
        out.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"Wrote {SAMPLE.with_name('bench_summary_result.json')}")


if __name__ == "__main__":
    main()
