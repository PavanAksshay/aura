# Running Aura with Docker

Aura can be run locally or deployed via Docker and Docker Compose. This packages the Next.js frontend, the FastAPI backend, and a local Ollama LLM instance with persistent model caching.

---

## Architecture Overview

```
                        ┌──────────────────────────────┐
                        │   Browser (Clinician PWA)   │
                        └──────────────┬───────────────┘
                                       │
                        ┌──────────────┴───────────────┐
                        │    aura-frontend (:3000)     │
                        │    (Next.js Standalone)      │
                        └──────────────┬───────────────┘
                                       │
                                       ▼
                        ┌──────────────────────────────┐
                        │     aura-backend (:8000)     │
                        │ (FastAPI + Whisper + Diariz) │
                        └──────────────┬───────────────┘
                                       │
                   ┌───────────────────┴───────────────────┐
                   ▼                                       ▼
    ┌──────────────────────────────┐        ┌──────────────────────────────┐
    │     aura-ollama (:11434)     │        │     aura-tunnel (Cloudflare) │
    │  (Ollama + llama3.2:3b model)│        │   Public HTTPS trycloudflare │
    └──────────────────────────────┘        └──────────────────────────────┘
```

---

## Prerequisites

- [Docker Engine & Docker Compose](https://docs.docker.com/get-docker/) (v20.10+ / Compose v2+)
- A Supabase project (with migrations `supabase/migrations/0001` through `0014` applied)

---

## Quick Start with Docker Compose

### 1. Configure Environment Variables

Create or update the `.env` file in the project root:

```bash
cp backend/.env.example .env
```

Ensure the following variables are filled in `.env`:

```env
# Supabase (Required)
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_JWT_SECRET=your-jwt-secret
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# VAPID Push Notifications (Optional, but recommended)
VAPID_PUBLIC_KEY=your-public-key
VAPID_PRIVATE_KEY=your-private-key
VAPID_SUBJECT=mailto:admin@example.com

# Diarization (Optional: Hugging Face token with access to pyannote models)
HF_TOKEN=your-hf-token
ENABLE_DIARIZATION=true
```

### 2. Build and Start All Containers

Run the following command in the root directory:

```bash
docker compose up --build
```

To run in detached background mode:

```bash
docker compose up --build -d
```

### 3. Verify Services

- **Frontend:** Open [http://localhost:3000](http://localhost:3000) in your browser.
- **Backend Health Check:** [http://localhost:8000/api/v1/health](http://localhost:8000/api/v1/health) (returns `{"status":"ok"}`).
- **Ollama:** Accessible at `http://localhost:11434`. The `ollama-init` service will automatically pull `llama3.2:3b`.

---

## Useful Docker Commands

### View Logs

```bash
# Follow logs from all services
docker compose logs -f

# Follow logs from a specific service
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f ollama
```

### Stop Services

```bash
docker compose down
```

To stop and remove all volumes (including downloaded models and caches):

```bash
docker compose down -v
```

### Rebuild a Specific Service

```bash
docker compose up --build backend
docker compose up --build frontend
```

---

## Building Standalone Images

### Backend Image

```bash
docker build -t aura-backend ./backend
docker run -p 8000:8000 --env-file .env aura-backend
```

### Frontend Image

```bash
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL="https://your-project-ref.supabase.co" \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key" \
  --build-arg NEXT_PUBLIC_API_URL="http://localhost:8000" \
  -t aura-frontend ./frontend

docker run -p 3000:3000 aura-frontend
```

---

## Hardware & Volume Persistence

- **AI Model Cache:** The `aura_ollama_models`, `aura_hf_cache`, and `aura_fastembed_cache` volumes ensure Whisper, Hugging Face, FastEmbed, and Ollama models are cached and NOT re-downloaded between container restarts.
- **Audio Ephemerality:** Audio scratch files reside inside the container's `/tmp/clinical-scribe-audio` directory and are automatically purged at startup and after each transcription job completes.
