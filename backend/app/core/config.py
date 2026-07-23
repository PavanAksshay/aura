"""Application settings, loaded once from the environment (.env in dev).

Every knob the service exposes lives here so configuration is auditable in
one place — important for a service that touches clinical audio.
"""

import tempfile
from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


def _default_scratch_dir() -> Path:
    """Per-process default under the system temp dir; overridable via env."""
    return Path(tempfile.gettempdir()) / "clinical-scribe-audio"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    # Supabase
    supabase_url: str = "http://localhost:54321"
    supabase_service_role_key: str = ""
    supabase_jwt_secret: str = ""

    # HTTP
    allowed_origins: str = "http://localhost:3000"
    # "development" | "production". In production the interactive API docs
    # (/docs, /redoc, /openapi.json) are disabled to avoid exposing the schema.
    environment: str = "development"

    # How many transcription pipelines may run at once. Each one holds a
    # Whisper model, a pyannote pass and an Ollama call, on ONE machine — so
    # this is a hard physical limit, not a tuning knob. Measured on an 8 GB M1:
    # a single job runs at 4.2x realtime idle and 8.5x under light contention,
    # so raising this does not get work done faster, it just makes every job
    # slower at once and risks exhausting memory. Extra jobs queue.
    max_concurrent_transcriptions: int = 1

    # Transcription: Whisper via faster-whisper (CTranslate2), fully local.
    # "large-v3" = maximum accuracy; int8 keeps it runnable on CPU.
    whisper_model: str = "large-v3"
    whisper_compute_type: str = "int8"

    # Speaker diarization (pyannote.audio). Optional enhancement: when enabled
    # AND the deps + gated model are available, transcripts are speaker-labeled;
    # otherwise the pipeline falls back to a plain transcript. The pyannote
    # models are gated on Hugging Face — hf_token must belong to an account that
    # has accepted the conditions for both the diarization and segmentation
    # models. hf_token is read from HF_TOKEN in the environment.
    enable_diarization: bool = True
    # Romanize non-English (Tamil/Hindi) transcripts to the Latin alphabet, so
    # the stored transcript has no Indic letters. The note is still built from
    # the original transcript, so this only affects the readable transcript.
    romanize_transcripts: bool = True
    # community-1 is pyannote.audio 4.x's flagship open pipeline (supersedes
    # the 3.1 pipeline, higher accuracy). Gated on HF like all pyannote models.
    diarization_model: str = "pyannote/speaker-diarization-community-1"
    # Torch device for diarization. "" = auto (Apple's MPS GPU when available,
    # else CPU). On an M1, MPS ran diarization at ~0.5x realtime versus CPU's
    # tens-of-minutes on the 8 GB machine. Set to "cpu" to force CPU.
    diarization_device: str = ""
    hf_token: str = ""
    # Label diarized speakers by role instead of "Speaker N". The first voice
    # to speak is assumed to be the therapist (they open the session); the rest
    # become Patient, Patient 2, … Set false to keep neutral "Speaker N" labels.
    label_speaker_roles: bool = True

    # Patient-memory embeddings, computed in-process (fastembed/ONNX).
    # 768-dim — must match the vector(768) columns in migration 0005.
    #
    # bge-base beat nomic-embed-text-v1.5 on this corpus (4/4 vs 3/4 correct
    # top-1 on real clinician questions) at 2.5x smaller (0.21 GB vs 0.52 GB),
    # which matters on an 8 GB machine also holding Whisper + Ollama.
    # CHANGING THIS INVALIDATES EVERY STORED VECTOR — re-index all notes after.
    embedding_model: str = "BAAI/bge-base-en-v1.5"

    # Local LLM (Ollama) for on-demand transcript summaries. Fully local; if
    # unreachable the summarizer falls back to a deterministic heuristic.
    ollama_url: str = "http://localhost:11434"
    summary_model: str = "llama3.2:3b"

    # AI usage quota. Every Ollama call runs on the operator's own machine, so
    # guests get a daily allowance and the operator does not. Matched against
    # the JWT-verified email claim (see core/quota.py) — never a client-supplied
    # value. Set ai_daily_limit to 0 to disable the quota entirely.
    owner_email: str = ""
    ai_daily_limit: int = 25

    # Web Push (VAPID) for appointment reminders that arrive with the app
    # closed. Empty keys disable the reminder scheduler entirely.
    vapid_public_key: str = ""
    vapid_private_key: str = ""
    vapid_subject: str = "mailto:admin@example.com"
    # How far ahead of an appointment to push the reminder, and how often the
    # scheduler wakes to look for due ones.
    reminder_lead_minutes: int = 10
    reminder_poll_seconds: int = 60

    audio_scratch_dir: Path = Field(default_factory=_default_scratch_dir)
    max_audio_bytes: int = 100 * 1024 * 1024

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    """Cached accessor so every module shares one Settings instance."""
    return Settings()
