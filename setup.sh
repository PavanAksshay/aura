#!/usr/bin/env bash
#
# Aura — local setup.
#
#   ./setup.sh
#
# Aura runs entirely on this machine, by design: session audio is transcribed
# by a local Whisper model and notes are drafted by a local LLM, so nothing is
# sent to a cloud AI service. That is the whole point of the product, and it is
# also why there is no container image or cloud deploy here — see README.
#
# This script prepares the environment. It does not start anything, because the
# backend, Ollama and the frontend all want their own terminal.
#
# Deliberately verbose about what is missing rather than failing at the first
# error: a half-configured install that reports itself as "down for
# maintenance" is far harder to debug than one that refuses to start.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

green() { printf '\033[0;32m%s\033[0m\n' "$1"; }
yellow() { printf '\033[0;33m%s\033[0m\n' "$1"; }
red() { printf '\033[0;31m%s\033[0m\n' "$1"; }

missing=0
need() {
  if ! command -v "$1" >/dev/null 2>&1; then
    red "  missing: $1 — $2"
    missing=1
  else
    green "  found:   $1"
  fi
}

echo "Checking prerequisites…"
need python3 "https://www.python.org/downloads/ (3.12+)"
need node "https://nodejs.org (20+)"
need ffmpeg "brew install ffmpeg — decodes the browser's webm/opus audio"
need ollama "https://ollama.com/download — drafts the session notes locally"
if [ "$missing" -ne 0 ]; then
  red "Install the missing tools above, then run ./setup.sh again."
  exit 1
fi

# --- env files --------------------------------------------------------------
if [ ! -f backend/.env ]; then
  cp backend/.env.example backend/.env
  yellow "Created backend/.env from the template."
fi
if [ ! -f frontend/.env.local ]; then
  cp frontend/.env.example frontend/.env.local
  yellow "Created frontend/.env.local from the template."
fi

# --- VAPID ------------------------------------------------------------------
# Empty keys silently disable every appointment reminder, so generate a pair if
# the backend has none. Both sides must carry the SAME public key.
if ! grep -qE '^VAPID_PRIVATE_KEY=.+' backend/.env 2>/dev/null; then
  if python3 -c "import cryptography" >/dev/null 2>&1; then
    echo "Generating a Web Push (VAPID) keypair…"
    keys="$(python3 backend/scripts/generate_vapid_keys.py)"
    pub="$(echo "$keys" | grep '^VAPID_PUBLIC_KEY=' | cut -d= -f2-)"
    priv="$(echo "$keys" | grep '^VAPID_PRIVATE_KEY=' | cut -d= -f2-)"

    # BSD and GNU sed take different -i arguments; rewrite via a temp file.
    grep -v '^VAPID_PUBLIC_KEY=\|^VAPID_PRIVATE_KEY=' backend/.env > backend/.env.tmp
    printf 'VAPID_PUBLIC_KEY=%s\nVAPID_PRIVATE_KEY=%s\n' "$pub" "$priv" >> backend/.env.tmp
    mv backend/.env.tmp backend/.env

    grep -v '^NEXT_PUBLIC_VAPID_PUBLIC_KEY=' frontend/.env.local > frontend/.env.local.tmp
    printf 'NEXT_PUBLIC_VAPID_PUBLIC_KEY=%s\n' "$pub" >> frontend/.env.local.tmp
    mv frontend/.env.local.tmp frontend/.env.local
    green "VAPID keypair written to both env files."
  else
    yellow "Skipped VAPID generation (needs python3 + cryptography)."
    yellow "Reminders stay disabled until you run:"
    yellow "  python3 backend/scripts/generate_vapid_keys.py"
  fi
fi

# --- Python deps ------------------------------------------------------------
if [ ! -d backend/.venv ]; then
  echo "Creating the backend virtualenv (this pulls PyTorch — several minutes)…"
  python3 -m venv backend/.venv
  # shellcheck disable=SC1091
  backend/.venv/bin/pip install --quiet --upgrade pip
  (cd backend && .venv/bin/pip install -e ".[ml,diarization,dev]")
  green "Backend dependencies installed."
else
  green "backend/.venv already exists — leaving it alone."
fi

# --- Ollama model -----------------------------------------------------------
if ! ollama list 2>/dev/null | grep -q "llama3.2:3b"; then
  echo "Pulling the note-drafting model (llama3.2:3b)…"
  ollama pull llama3.2:3b || yellow "Could not pull the model — start Ollama and retry."
fi

# --- Supabase ---------------------------------------------------------------
if grep -q 'your-project-ref' backend/.env 2>/dev/null; then
  echo
  yellow "Aura needs a Supabase project before it can store anything."
  yellow "Fill these in backend/.env and frontend/.env.local:"
  yellow "  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_JWT_SECRET"
  yellow "  NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY"
  yellow "Then apply supabase/migrations/*.sql in order."
fi

echo
green "Setup complete. Start Aura in three terminals:"
echo
echo "  1.  ollama serve"
echo "  2.  cd backend  && .venv/bin/uvicorn app.main:app --reload --port 8000"
echo "  3.  cd frontend && npm install && npm run dev"
echo
echo "  Health:  curl http://localhost:8000/api/v1/health"
echo
yellow "Two things that bite people later:"
yellow "  · NEXT_PUBLIC_API_URL is baked into the frontend's CSP at BUILD time."
yellow "    Change it and you must rebuild, or every backend call is blocked."
yellow "  · uvicorn --reload watches .py files, NOT .env. Restart properly"
yellow "    after changing settings, or you will debug a stale process."
