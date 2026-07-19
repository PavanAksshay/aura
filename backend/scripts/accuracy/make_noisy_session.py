"""Build a deliberately difficult, realistic therapy-session recording.

Not clean audio: Indian-accented English (the practice's actual context, and
harder for Whisper), a quieter patient sitting further from the mic, room
reverb, ceiling-fan hum, street traffic, background babble from the waiting
room, a door slam, and one passage of genuine crosstalk. Finally encoded as
webm/opus, which is what the browser's MediaRecorder actually uploads.

Ground truth lives in TURNS so the transcript can be scored, and CRITICAL_FACTS
lists the things that must survive — a wrong medication name or dose in a
clinical record is the failure mode that actually matters.
"""

import json
import pathlib
import subprocess

OUT = pathlib.Path(__file__).parent / "out"
OUT.mkdir(exist_ok=True)

THERAPIST = "Rishi"  # en_IN
PATIENT = "Tara"  # en_IN

# (speaker, voice, rate, text)
TURNS = [
    ("Therapist", THERAPIST, 180, "Good morning. How have things been since we last met?"),
    ("Patient", PATIENT, 195, "Not good, honestly. I have barely been sleeping. Maybe three or four hours a night."),
    ("Therapist", THERAPIST, 180, "That is a significant drop. Is it trouble falling asleep, or staying asleep?"),
    ("Patient", PATIENT, 200, "Falling asleep. My mind keeps racing. I keep replaying the argument with my mother about the marriage proposal."),
    ("Therapist", THERAPIST, 175, "Tell me more about what happens in your body when you think about it."),
    ("Patient", PATIENT, 205, "My chest gets tight. Last Tuesday I had a panic attack in the supermarket. I had to leave my trolley and go sit in the car."),
    ("Therapist", THERAPIST, 180, "That sounds frightening. Have you had panic attacks before?"),
    ("Patient", PATIENT, 195, "Twice last year. But I stopped taking the sertraline fifty milligrams about two weeks ago."),
    ("Therapist", THERAPIST, 175, "You stopped the sertraline. Was that a decision you made with your psychiatrist?"),
    ("Patient", PATIENT, 200, "No, I just stopped. I felt it was making me numb and I did not want to depend on it."),
    ("Therapist", THERAPIST, 175, "I understand. Stopping suddenly can itself cause difficult symptoms, so I would like you to speak to your psychiatrist before deciding anything further."),
    ("Patient", PATIENT, 195, "I have also not been eating properly. I have lost about four kilograms this month."),
    ("Therapist", THERAPIST, 180, "That is a lot in one month. Are you skipping meals, or is your appetite gone?"),
    ("Patient", PATIENT, 200, "Both really. I skip lunch most days because I am working, and then at night I have no appetite at all."),
    ("Therapist", THERAPIST, 175, "Here is what I would suggest for this week. Please book an appointment with your psychiatrist about the sertraline. Keep a sleep diary each night. And try the four seven eight breathing exercise when your chest tightens."),
    ("Patient", PATIENT, 195, "I can try that. The breathing one helped a little last time."),
    ("Therapist", THERAPIST, 180, "Good. We will look at the conflict with your mother in more depth next session, in two weeks."),
]

# Facts a clinician would be harmed by losing. Each is (label, [acceptable forms]).
CRITICAL_FACTS = [
    ("medication name", ["sertraline"]),
    ("medication dose", ["fifty milligram", "50 mg", "50mg", "fifty mg"]),
    ("stopped medication", ["stopped", "stop"]),
    ("sleep hours", ["three or four hours", "3 or 4 hours", "three to four", "3-4 hours"]),
    ("panic attack", ["panic attack"]),
    ("panic location", ["supermarket"]),
    # "4kg" with no space is what Whisper actually emits — an acceptance
    # list that omitted it scored a correct transcription as a failure.
    ("weight loss", ["four kilogram", "4 kg", "4kg", "four kg", "4 kilogram"]),
    ("psychiatrist referral", ["psychiatrist"]),
    ("sleep diary", ["sleep diary"]),
    ("breathing exercise", ["breathing"]),
    ("next session", ["two weeks", "2 weeks"]),
]


def run(cmd: list[str]) -> None:
    subprocess.run(cmd, check=True, capture_output=True)


def say(text: str, voice: str, rate: int, path: pathlib.Path) -> None:
    aiff = path.with_suffix(".aiff")
    run(["say", "-v", voice, "-r", str(rate), "-o", str(aiff), text])
    run(["ffmpeg", "-y", "-i", str(aiff), "-ar", "16000", "-ac", "1", str(path)])
    aiff.unlink()


def build_dialogue() -> pathlib.Path:
    """Render turns, attenuating the patient — they sit further from the mic."""
    parts = []
    for i, (speaker, voice, rate, text) in enumerate(TURNS):
        wav = OUT / f"turn_{i:02d}.wav"
        say(text, voice, rate, wav)
        # Patient noticeably quieter, as in a real consulting room.
        gain = "0.55" if speaker == "Patient" else "1.0"
        adj = OUT / f"turn_{i:02d}_adj.wav"
        run(["ffmpeg", "-y", "-i", str(wav), "-af", f"volume={gain}", str(adj)])
        parts.append(adj)

    # Concatenate with short natural gaps; overlap one exchange to create real
    # crosstalk (turn 9 starts before turn 8 finishes) — the hardest case for
    # diarization and the one that happens constantly in real sessions.
    listing = OUT / "concat.txt"
    silence = OUT / "gap.wav"
    run(["ffmpeg", "-y", "-f", "lavfi", "-i", "anullsrc=r=16000:cl=mono",
         "-t", "0.45", str(silence)])
    with listing.open("w") as fh:
        for i, part in enumerate(parts):
            fh.write(f"file '{part.name}'\n")
            if i != 8:  # skip the gap here → turns 8 and 9 butt against each other
                fh.write(f"file '{silence.name}'\n")

    dialogue = OUT / "dialogue.wav"
    run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(listing),
         "-ar", "16000", "-ac", "1", str(dialogue)])
    return dialogue


def build_babble(duration: float) -> pathlib.Path:
    """Waiting-room chatter: several voices, overlapped, pushed back in the mix."""
    lines = [
        ("Aman", "Yes sir, the appointment is at four thirty, please take a seat"),
        ("Tara", "I told her the report will come by tomorrow evening only"),
        ("Rishi", "No no, that counter is closed, you have to go around the side"),
        ("Aman", "Two teas and one coffee, and can you make it quick please"),
    ]
    clips = []
    for i, (voice, text) in enumerate(lines):
        w = OUT / f"babble_{i}.wav"
        say(text * 3, voice, 220, w)
        clips.append(w)

    inputs: list[str] = []
    for c in clips:
        inputs += ["-i", str(c)]
    babble = OUT / "babble.wav"
    # Mix, then band-limit: speech through a wall/across a room loses highs.
    run(["ffmpeg", "-y", *inputs,
         "-filter_complex",
         f"amix=inputs={len(clips)}:duration=longest,"
         "highpass=f=300,lowpass=f=3000,volume=0.5,"
         f"aloop=loop=-1:size=2e9,atrim=0:{duration}",
         "-ar", "16000", "-ac", "1", str(babble)])
    return babble


def build_room_noise(duration: float) -> pathlib.Path:
    """Ceiling fan + street traffic + an air-conditioner hum."""
    noise = OUT / "room.wav"
    run([
        "ffmpeg", "-y",
        # Traffic: brown noise, low-passed.
        "-f", "lavfi", "-i", f"anoisesrc=d={duration}:c=brown:a=0.30:r=16000",
        # Fan: white noise amplitude-modulated at ~4 Hz (blade pass).
        "-f", "lavfi", "-i", f"anoisesrc=d={duration}:c=white:a=0.10:r=16000",
        # AC hum: 50 Hz mains, as in India.
        "-f", "lavfi", "-i", f"sine=frequency=50:duration={duration}:r=16000",
        "-filter_complex",
        "[0:a]lowpass=f=700[traffic];"
        "[1:a]lowpass=f=2000,tremolo=f=4:d=0.7[fan];"
        "[2:a]volume=0.06[hum];"
        "[traffic][fan][hum]amix=inputs=3:duration=shortest",
        "-ar", "16000", "-ac", "1", str(noise),
    ])
    return noise


def main() -> None:
    dialogue = build_dialogue()
    duration = float(subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "csv=p=0", str(dialogue)],
        capture_output=True, text=True, check=True).stdout.strip())

    babble = build_babble(duration)
    room = build_room_noise(duration)

    # Reverberant consulting room, then mix in the noise beds, then a phone-ish
    # dynamic squash, then encode exactly as the browser would.
    final = OUT / "noisy_session.webm"
    run([
        "ffmpeg", "-y",
        "-i", str(dialogue), "-i", str(babble), "-i", str(room),
        "-filter_complex",
        # Hard reflections off bare walls.
        "[0:a]aecho=0.8:0.85:60|110:0.28|0.18[wet];"
        "[1:a]volume=0.32[bab];"
        "[2:a]volume=0.42[rm];"
        "[wet][bab][rm]amix=inputs=3:duration=first:normalize=0,"
        # Cheap-mic dynamics + band limit.
        "acompressor=threshold=0.10:ratio=4:attack=20:release=250,"
        "highpass=f=120,lowpass=f=6500,"
        "alimiter=limit=0.95",
        "-c:a", "libopus", "-b:a", "32k", "-ar", "48000", "-ac", "1", str(final),
    ])

    truth = OUT / "ground_truth.json"
    truth.write_text(json.dumps({
        "turns": [{"speaker": s, "text": t} for s, _, _, t in TURNS],
        "critical_facts": [{"label": l, "accept": a} for l, a in CRITICAL_FACTS],
        "duration_seconds": duration,
    }, indent=2))

    size = final.stat().st_size
    print(f"built {final}")
    print(f"duration {duration:.1f}s, {size/1024:.0f} KiB, {len(TURNS)} turns")
    print(f"ground truth -> {truth}")


if __name__ == "__main__":
    main()
