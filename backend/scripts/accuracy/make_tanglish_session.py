"""Build a realistic, noisy *Tanglish* (Tamil + English) therapy recording.

Same treatment as make_noisy_session.py — Indian consulting-room reverb, fan
hum, traffic, waiting-room babble, a quieter patient — but the dialogue is
code-switched Tamil/English spoken by the macOS Tamil voice (Vani). Because
there is only one Tamil system voice, the therapist's turns are pitch-shifted
down so diarization has two distinguishable speakers, exactly as in a real
two-person room.

This is synthetic audio, not a human recording: cleaner articulation, no real
accent variation. It exercises the true Whisper + summary pipeline on noisy
Tamil-script speech, but the honest real-world test is a human recording.
"""

import pathlib
import subprocess

# Reuse the noise beds and helpers from the English harness.
from make_noisy_session import OUT, build_babble, build_room_noise, run, say

VANI = "Vani"  # ta_IN — the only Tamil system voice

# (speaker, text). English words are kept in Latin; Vani speaks them with a
# Tamil accent and Whisper transliterates them to Tamil script, which is what
# real Tanglish transcription does.
TURNS = [
    ("Therapist", "வணக்கம் Divya, இந்த வாரம் எப்படி இருந்தீங்க?"),
    ("Patient", "சார், ரொம்ப tough ஆ இருந்துச்சு. இரவுல தூக்கமே வரலை. படுத்தாலும் மனசுல office work பத்தி யோசனை ஓடிக்கிட்டே இருக்கு."),
    ("Therapist", "ஒரு நாளைக்கு எத்தனை மணி நேரம் தூங்குறீங்க?"),
    ("Patient", "மூணு மணி நேரம் தான் சார். காலைல எழுந்தா full tired ஆ இருக்கு, work la concentrate பண்ண முடியலை."),
    ("Therapist", "சாப்பாடு appetite எல்லாம் எப்படி இருக்கு?"),
    ("Patient", "பசியே இல்ல சார். சில நாள் lunch கூட skip பண்றேன். இந்த வாரம் gym போறதையும் நிறுத்திட்டேன், energy இல்ல."),
    ("Therapist", "இந்த anxiety ஆ trigger பண்றது office la ஏதாவது specific ஆ இருக்கா?"),
    ("Patient", "என் manager அடுத்த மாசம் appraisal பத்தி சொன்னாரு. நான் fail ஆயிடுவேனோ, எல்லாரும் judge பண்ணுவாங்களோ ங்கிற பயம் சார்."),
    ("Therapist", "சரி, ஒரு plan பண்ணலாம். தினமும் படுக்கறதுக்கு முன்னாடி அந்த four seven eight breathing exercise try பண்ணுங்க. இரவு பதினொரு மணிக்கு fixed bedtime வெச்சுக்கோங்க."),
    ("Patient", "சரி சார், try பண்றேன்."),
    ("Therapist", "தினமும் ஒரு sheet la எந்த thought worry பண்ணுதோ அத எழுதி வெச்சுக்கோங்க. அடுத்த session la அந்த appraisal fear பத்தி பேசலாம்."),
    ("Patient", "ஓகே சார், நன்றி."),
]


def pitch_shift(src: pathlib.Path, dst: pathlib.Path, factor: float) -> None:
    """Shift pitch while preserving duration, to fake a second speaker."""
    run(["ffmpeg", "-y", "-i", str(src),
         "-af", f"asetrate=16000*{factor},aresample=16000,atempo={1/factor:.4f}",
         "-ar", "16000", "-ac", "1", str(dst)])


def build_dialogue() -> pathlib.Path:
    parts = []
    for i, (speaker, text) in enumerate(TURNS):
        wav = OUT / f"tt_{i:02d}.wav"
        say(text, VANI, 178, wav)
        stage = wav
        # Therapist pitched down → a distinct (lower) voice for diarization.
        if speaker == "Therapist":
            shifted = OUT / f"tt_{i:02d}_p.wav"
            pitch_shift(wav, shifted, 0.82)
            stage = shifted
        # Patient sits further from the mic.
        gain = "0.6" if speaker == "Patient" else "1.0"
        adj = OUT / f"tt_{i:02d}_adj.wav"
        run(["ffmpeg", "-y", "-i", str(stage), "-af", f"volume={gain}", str(adj)])
        parts.append(adj)

    listing = OUT / "tt_concat.txt"
    silence = OUT / "tt_gap.wav"
    run(["ffmpeg", "-y", "-f", "lavfi", "-i", "anullsrc=r=16000:cl=mono",
         "-t", "0.4", str(silence)])
    with listing.open("w") as fh:
        for part in parts:
            fh.write(f"file '{part.name}'\n")
            fh.write(f"file '{silence.name}'\n")

    dialogue = OUT / "tt_dialogue.wav"
    run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(listing),
         "-ar", "16000", "-ac", "1", str(dialogue)])
    return dialogue


def main() -> None:
    dialogue = build_dialogue()
    duration = float(subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "csv=p=0", str(dialogue)],
        capture_output=True, text=True, check=True).stdout.strip())

    babble = build_babble(duration)
    room = build_room_noise(duration)

    final = OUT / "tanglish_session.webm"
    run([
        "ffmpeg", "-y",
        "-i", str(dialogue), "-i", str(babble), "-i", str(room),
        "-filter_complex",
        "[0:a]aecho=0.8:0.85:60|110:0.28|0.18[wet];"
        "[1:a]volume=0.30[bab];"
        "[2:a]volume=0.40[rm];"
        "[wet][bab][rm]amix=inputs=3:duration=first:normalize=0,"
        "acompressor=threshold=0.10:ratio=4:attack=20:release=250,"
        "highpass=f=120,lowpass=f=6500,"
        "alimiter=limit=0.95",
        "-c:a", "libopus", "-b:a", "32k", "-ar", "48000", "-ac", "1", str(final),
    ])

    print(f"built {final}")
    print(f"duration {duration:.1f}s, {final.stat().st_size/1024:.0f} KiB, {len(TURNS)} turns")


if __name__ == "__main__":
    main()
