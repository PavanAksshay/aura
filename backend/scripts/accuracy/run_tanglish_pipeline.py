"""Run the REAL pipeline on the noisy Tanglish recording: audio -> transcript
(Whisper large-v3 + diarization) -> English note (build_session_note).

Writes each stage to disk the moment it is ready, so an interrupted run still
shows the transcript. Nothing here is mocked; this is the same code the app
runs for a live session.
"""

from __future__ import annotations

import json
import time
from pathlib import Path

from app.services.note import _is_multilingual, build_session_note
from app.services.transcription import transcribe_audio

HERE = Path(__file__).parent
AUDIO = HERE / "out" / "tanglish_session.webm"
RESULT = HERE / "tanglish_result.json"


def main() -> None:
    out: dict = {"audio": str(AUDIO)}

    t0 = time.perf_counter()
    transcript = transcribe_audio(AUDIO)
    out["transcript_seconds"] = round(time.perf_counter() - t0, 1)
    out["transcript"] = transcript
    out["detected_non_english"] = _is_multilingual(transcript)
    RESULT.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print("=== TRANSCRIPT ({}s) — non-English detected: {} ===".format(
        out["transcript_seconds"], out["detected_non_english"]))
    print(transcript)
    print()

    t1 = time.perf_counter()
    note = build_session_note(transcript)
    out["summary_seconds"] = round(time.perf_counter() - t1, 1)
    out["discussed"] = note.discussed
    out["ahead"] = note.ahead
    RESULT.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")

    print("=== SUMMARY ({}s) ===".format(out["summary_seconds"]))
    print("WHAT WAS DISCUSSED:")
    for b in note.discussed:
        print(f"  - {b}")
    print("WHAT LIES AHEAD:")
    for b in note.ahead:
        print(f"  - {b}")
    print(f"\nWrote {RESULT}")


if __name__ == "__main__":
    main()
