# Aura backend — Whisper + embeddings + note structuring, all in-process.
#
# Two stages so the ~2 GB of build tooling (PyTorch wheels, compilers) never
# reaches the runtime image.
#
# NOTE ON SIZE: with the `diarization` extra this image is large (PyTorch is
# ~2 GB on its own). Build without it for a much smaller image that still
# transcribes and writes notes — you only lose Therapist/Patient labels.
#   docker build --build-arg EXTRAS=ml -t aura-backend .

FROM python:3.12-slim AS builder

ARG EXTRAS=ml,diarization

# build-essential: some wheels compile on arm64. curl: healthcheck in runtime.
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build
COPY pyproject.toml ./
COPY app ./app

# Install into a venv we can copy wholesale into the runtime stage.
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir ".[${EXTRAS}]"


FROM python:3.12-slim AS runtime

# ffmpeg: PyAV decodes browser webm/opus. curl: container healthcheck.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg curl \
    && rm -rf /var/lib/apt/lists/*

# Never run the service as root — it holds the service-role key.
RUN useradd --create-home --uid 1000 aura

COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    # Model weights land here; mount a volume so they survive a rebuild
    # (large-v3 alone is ~1.5 GB and re-downloading is slow).
    HF_HOME=/home/aura/.cache/huggingface

WORKDIR /app
COPY --chown=aura:aura app ./app
COPY --chown=aura:aura pyproject.toml ./

RUN mkdir -p /home/aura/.cache/huggingface /tmp/clinical-scribe-audio \
    && chown -R aura:aura /home/aura/.cache /tmp/clinical-scribe-audio

USER aura
EXPOSE 8000

# Whisper's first request downloads weights, so allow a slow start before the
# container is judged unhealthy.
HEALTHCHECK --interval=30s --timeout=5s --start-period=180s --retries=3 \
    CMD curl -fsS http://localhost:8000/api/v1/health || exit 1

# One worker on purpose: the Whisper model is ~2 GB resident and each worker
# would load its own copy. Concurrency comes from FastAPI's threadpool.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
