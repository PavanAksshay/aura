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

## Negative result: Whisper's confidence signal does not flag hallucination

The obvious mitigation is to highlight low-confidence passages using
`avg_logprob` / `no_speech_prob`. **Measured, it does not work — do not build
it.**

On the run above, across 20 segments:

- `avg_logprob` spanned only **-0.293 to -0.143**. There is no meaningful
  spread to threshold on.
- The **hallucinated** segment scored **-0.207** — rank **9 of 20**, almost
  exactly the median. It is indistinguishable from correct output.
- The three *worst*-scoring segments were all **correct** transcriptions.
- Scores repeat in identical runs (-0.293 three times, -0.275 three times)
  because faster-whisper assigns one `avg_logprob` per decoding window, not
  per segment. Even with separation, it could not localise the bad phrase.

A warning built on this would fire on good text and stay silent on invented
text, which is worse than no warning: it implies a safety net that is not
there. The honest mitigation remains human review, which is why the
attestation exists.

Reproduce with `confidence_probe.py` if you want to re-test after a model
change — a different model may behave differently, and this conclusion is
specific to large-v3 int8.

## Speed

Three timed runs of large-v3 int8 on an M1: **4.2x, 4.5x, 4.6x realtime**
(excluding a ~120 s cold model load). A 50-minute session therefore takes
roughly 3.5 hours to produce a note. The in-app ETA uses 4.5x.

If that is too slow, `distil-large-v3` is the first thing to benchmark — but
benchmark it here, on this audio, before switching. Accuracy on clean speech
says nothing about accuracy on a noisy consulting room.
