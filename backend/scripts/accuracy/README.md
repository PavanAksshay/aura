# Accuracy harness

Measures what the pipeline actually does to a **hard** recording, not a clean one.

```bash
python scripts/accuracy/make_noisy_session.py   # build the audio (needs ffmpeg + macOS `say`)
python scripts/accuracy/score_session.py        # run the real pipeline and score it
```

## Why noisy

Clean synthetic speech flatters the pipeline and tells you nothing. The
generated recording deliberately stacks the failure modes of a real consulting
room:

- **Indian-accented English** (`say -v Rishi/Tara`) — the practice's actual
  context, and harder for Whisper than US English.
- **Unequal levels** — the patient is attenuated, as when they sit further from
  the mic.
- **Room reverb** off bare walls, a **ceiling fan**, **street traffic**, a 50 Hz
  **mains hum**, and **waiting-room babble**.
- **Crosstalk** — one exchange overlaps, which is the case diarization handles
  worst and real sessions produce constantly.
- **webm/opus at 32 kbps**, which is what the browser's MediaRecorder uploads.

Measured SNR is ~12 dB. Verify with:

```bash
ffmpeg -i out/noisy_session.webm -af volumedetect -f null -
```

## What it scores

Three things, separately, because they fail differently:

1. **Word error rate** against the ground-truth script.
2. **Critical clinical facts** — medication name and dose, weight loss, panic
   symptoms, the agreed plan. A 10% WER concentrated on filler words is
   survivable; the same WER landing on "sertraline 50 mg" is not.
3. **Whether those facts reach the note**, which is what the clinician reads.

`baseline_result.json` holds the current measured baseline. Compare against it
after changing the Whisper model, compute type, diarization, or the note prompt.

## Baseline (M1, large-v3 int8, 103 s of audio)

| Metric | Result |
|---|---|
| Word error rate | 10.2% |
| Critical facts in transcript | 10/11 |
| Critical facts in note | 7/11 |
| Speed | 4.2x realtime |

Two failures worth knowing about, both visible in the saved transcript:

- Whisper **hallucinated** fluent nonsense over one low-SNR passage
  ("closed a movie, Sahasran Questiony, a freaky rendering"), where the speech
  was simply "Twice last year." It does not signal uncertainty.
- One error **inverted clinical meaning**: "the breathing one helped a little"
  became "but breathing won't help a little".

Neither is fixable by prompt engineering. They are the reason the note carries
an unreviewed-draft warning until a clinician attests to it.
