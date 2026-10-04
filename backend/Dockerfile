# --- Aura Backend Dockerfile ---
FROM python:3.12-slim-bookworm

# System dependencies:
# - ffmpeg: audio decoding (opus/webm from browser)
# - build-essential & git: for compiling dependencies if needed
# - curl: health check and utility
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    build-essential \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Set python environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    AUDIO_SCRATCH_DIR=/tmp/clinical-scribe-audio \
    PIP_NO_CACHE_DIR=1

# Copy dependency specifications first for layer caching
COPY pyproject.toml ./

# Install python dependencies (including ML & diarization support)
RUN pip install --upgrade pip setuptools && \
    pip install ".[ml,diarization]"

# Copy backend application source code
COPY app/ ./app/
COPY scripts/ ./scripts/

# Create audio scratch directory
RUN mkdir -p /tmp/clinical-scribe-audio

EXPOSE 8000

# Health check against liveness endpoint
HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -f http://localhost:8000/api/v1/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
