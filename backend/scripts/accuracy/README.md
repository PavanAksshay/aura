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

## First real recording (2026-07-19)

The first session recorded through the real app on real hardware, then
corrected by the clinician using the note editor. Their edit is the closest
thing to ground truth this project has.

| | |
|---|---|
| Audio | 45 s, real voice, real mic, browser capture |
| Transcript | Matched the spoken words exactly |
| Note as drafted | ~8 bullets |
| Note after clinician correction | **2 bullets** |

**Transcription was not the weak link — note construction was.** Whisper heard
every word correctly; the 3B model then turned a short recording into eight
bullets, and roughly three quarters of them were noise the clinician removed.

That direction of failure is worth naming precisely, because it is the
*opposite* of the fabrication problem found on noisy audio. Here nothing was
invented — every bullet was grounded in the transcript, which is exactly why
the grounding guard passed them. The model simply had no sense of what was
clinically *worth* recording, so it minuted everything.

Two implications:

- The grounding guard defends against invention, not against noise. A bullet
  can be perfectly faithful and still not belong in a record.
- Editing is not an edge case. On the first real session it was needed, which
  is why the editor exists and why the note is labelled an unverified draft
  until a human says otherwise.

Caveat on generality: one 45-second recording of deliberate test speech. It
says something real about note construction; it says nothing yet about a
50-minute session with a distressed patient.

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

## Speed, and why distil-large-v3 is not worth it

large-v3 int8 on an M1, excluding cold model load:

| Run | Speed | Notes |
|---|---|---|
| Scored run | 4.2x realtime | machine otherwise idle |
| Probe, idle | 4.5x realtime | |
| Probe, contended | 8.5x realtime | competing with a frontend build + pytest |

So **4.2x when idle, up to 8.5x under load** — a 50-minute session is ~3.5
hours idle and can double if the machine is busy. The in-app ETA uses 4.5x.
Do not run other heavy work during a transcription.

`distil-large-v3` transcribed the same audio in **46 s — 0.4x realtime**,
roughly 10-20x faster, which would turn that 3.5 hours into about 20 minutes.
**It is still the wrong trade**, because of what it did to the medication name:

| Ground truth | large-v3 | distil-large-v3 |
|---|---|---|
| "the sertraline fifty milligrams" | "the Sertraline 50mg" | "the **searcherline** 50 milligrams" |
| "You stopped the sertraline" | "You stopped the Sertraline" | "You stopped the **certoline**" |

It mangled the drug name twice, differently each time, so neither instance is
even correctable by find-and-replace. A speed win that costs the medication
name is not a speed win in a clinical record.

If you revisit this, benchmark on *this* audio and check the critical-facts
table, not the WER. Clean-speech benchmarks say nothing about a noisy
consulting room.

## The hallucination is reproducible, and cross-model

`confidence_probe.py` reported "hallucination did not reproduce" on the distil
run. That was a **false negative in the probe, not a clean run** — it matched
the literal string `sahasran`, and distil produced a variant:

- large-v3: "Twice last year closed a movie, **Sahasran Questiony**, a freaky
  rendering, and you knew me."
- distil:   "Twice last year closed the movie **Sahesan question me**, a frea…"

Ground truth for that passage is simply "Twice last year." Both models invent
fluent text there, in different words. It is a property of the audio (a
low-SNR passage after a short utterance), not a fluke of one decode — which is
why human review is the mitigation and a confidence threshold is not.
