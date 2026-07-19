"""Run the real pipeline on the noisy session and score it honestly.

Reports three things separately, because they fail differently:
  1. Word error rate against the ground-truth script.
  2. Whether each clinically critical fact survived (the one that matters).
  3. Whether the generated note keeps those facts and stays grounded.
"""

import json
import pathlib
import re
import sys
import time

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2]))

from app.services.note import build_session_note  # noqa: E402
from app.services.transcription import transcribe_audio  # noqa: E402

HERE = pathlib.Path(__file__).parent / "out"
AUDIO = HERE / "noisy_session.webm"
TRUTH = json.loads((HERE / "ground_truth.json").read_text())

_NORM = re.compile(r"[^a-z0-9 ]")


def normalize(text: str) -> str:
    text = text.lower()
    text = re.sub(r"\bspeaker \d+:|therapist:|patient(?: \d+)?:", " ", text)
    text = _NORM.sub(" ", text)
    return " ".join(text.split())


def wer(reference: str, hypothesis: str) -> tuple[float, int, int]:
    """Levenshtein over words → (rate, edits, reference length)."""
    ref, hyp = reference.split(), hypothesis.split()
    prev = list(range(len(hyp) + 1))
    for i, r in enumerate(ref, 1):
        cur = [i]
        for j, h in enumerate(hyp, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (r != h)))
        prev = cur
    return prev[-1] / max(len(ref), 1), prev[-1], len(ref)


def main() -> None:
    print(f"audio: {AUDIO.name}  ({AUDIO.stat().st_size / 1024:.0f} KiB, "
          f"{TRUTH['duration_seconds']:.0f}s)\n")

    started = time.time()
    transcript = transcribe_audio(AUDIO)
    elapsed = time.time() - started
    print(f"transcription took {elapsed:.0f}s "
          f"({elapsed / TRUTH['duration_seconds']:.1f}x realtime)\n")

    (HERE / "transcript.txt").write_text(transcript)
    print("=" * 70)
    print("TRANSCRIPT")
    print("=" * 70)
    print(transcript)

    reference = normalize(" ".join(t["text"] for t in TRUTH["turns"]))
    hypothesis = normalize(transcript)
    rate, edits, total = wer(reference, hypothesis)
    print()
    print("=" * 70)
    print(f"WORD ERROR RATE: {rate:.1%}  ({edits} edits over {total} words)")
    print("=" * 70)

    print("\nCRITICAL CLINICAL FACTS IN TRANSCRIPT")
    flat = hypothesis
    kept, lost = 0, []
    for fact in TRUTH["critical_facts"]:
        ok = any(normalize(a) in flat for a in fact["accept"])
        print(f"  {'PASS' if ok else 'FAIL'}  {fact['label']}")
        if ok:
            kept += 1
        else:
            lost.append(fact["label"])
    print(f"  → {kept}/{len(TRUTH['critical_facts'])} facts survived")

    # Speaker labelling: did diarization find two roles at all?
    labels = sorted(set(re.findall(r"^([A-Za-z ]+\d*):", transcript, re.M)))
    print(f"\nSPEAKER LABELS FOUND: {labels or 'none (undiarized)'}")

    print("\nGenerating note…")
    note = build_session_note(transcript)
    print("\n" + "=" * 70)
    print("WHAT WAS DISCUSSED")
    print("=" * 70)
    for b in note.discussed:
        print(f"  • {b}")
    print("\n" + "=" * 70)
    print("WHAT LIES AHEAD")
    print("=" * 70)
    for b in note.ahead:
        print(f"  • {b}")

    note_text = normalize(" ".join(note.discussed + note.ahead))
    print("\nCRITICAL FACTS CARRIED INTO THE NOTE")
    note_kept = 0
    for fact in TRUTH["critical_facts"]:
        ok = any(normalize(a) in note_text for a in fact["accept"])
        print(f"  {'PASS' if ok else '----'}  {fact['label']}")
        note_kept += ok
    print(f"  → {note_kept}/{len(TRUTH['critical_facts'])} facts in the note")

    json.dump({
        "wer": rate, "facts_in_transcript": kept, "facts_lost": lost,
        "facts_in_note": note_kept, "labels": labels,
        "discussed": note.discussed, "ahead": note.ahead,
        "seconds": elapsed,
    }, (HERE / "result.json").open("w"), indent=2)


if __name__ == "__main__":
    main()
