#!/usr/bin/env bash
#
# Aura — one-command setup.
#
#   ./setup.sh
#
# Checks prerequisites, creates the env files from their templates, generates a
# matching VAPID keypair, and starts the backend + local LLM. Everything runs on
# this machine; nothing is sent anywhere except the Supabase project you name.
#
# Deliberately verbose about what is missing rather than failing at the first
# error — a half-configured install that reports itself as "down for
# maintenance" is much harder to debug than one that refuses to start.

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
need docker "https://docs.docker.com/get-docker/"
if [ "$missing" -ne 0 ]; then
  red "Install the missing tools above, then run ./setup.sh again."
  exit 1
fi

# --- env files --------------------------------------------------------------
if [ ! -f backend/.env ]; then
  cp backend/.env.example backend/.env
  yellow "Created backend/.env from the template."
  NEEDS_SUPABASE=1
else
  green "backend/.env already exists — leaving it alone."
  NEEDS_SUPABASE=0
fi

if [ ! -f frontend/.env.local ]; then
  cp frontend/.env.example frontend/.env.local
  yellow "Created frontend/.env.local from the template."
  NEEDS_SUPABASE=1
fi

# --- VAPID ------------------------------------------------------------------
# Empty keys silently disable every appointment reminder, so generate a pair if
# the backend has none. Both sides must carry the SAME public key.
if ! grep -qE '^VAPID_PRIVATE_KEY=.+' backend/.env 2>/dev/null; then
  if command -v python3 >/dev/null 2>&1 &&
     python3 -c "import cryptography" >/dev/null 2>&1; then
    echo "Generating a Web Push (VAPID) keypair…"
    keys="$(python3 backend/scripts/generate_vapid_keys.py)"
    pub="$(echo "$keys" | grep '^VAPID_PUBLIC_KEY=' | cut -d= -f2-)"
    priv="$(echo "$keys" | grep '^VAPID_PRIVATE_KEY=' | cut -d= -f2-)"

    # BSD vs GNU sed take different -i arguments; rewrite with a temp file.
    for f in backend/.env; do
      grep -v '^VAPID_PUBLIC_KEY=\|^VAPID_PRIVATE_KEY=' "$f" > "$f.tmp"
      printf 'VAPID_PUBLIC_KEY=%s\nVAPID_PRIVATE_KEY=%s\n' "$pub" "$priv" >> "$f.tmp"
      mv "$f.tmp" "$f"
    done
    grep -v '^NEXT_PUBLIC_VAPID_PUBLIC_KEY=' frontend/.env.local > frontend/.env.local.tmp
    printf 'NEXT_PUBLIC_VAPID_PUBLIC_KEY=%s\n' "$pub" >> frontend/.env.local.tmp
    mv frontend/.env.local.tmp frontend/.env.local
    green "VAPID keypair written to both env files."
  else
    yellow "Skipped VAPID generation (needs python3 + cryptography)."
    yellow "Appointment reminders stay disabled until you run:"
    yellow "  python3 backend/scripts/generate_vapid_keys.py"
  fi
fi

# --- Supabase ---------------------------------------------------------------
if grep -q 'your-project-ref' backend/.env 2>/dev/null; then
  echo
  yellow "Aura needs a Supabase project before it can store anything."
  yellow "Fill these in backend/.env and frontend/.env.local:"
  yellow "  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_JWT_SECRET"
  yellow "  NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY"
  yellow "Then apply supabase/migrations/*.sql in order, and re-run ./setup.sh."
  exit 0
fi

# --- start ------------------------------------------------------------------
echo
echo "Starting backend + Ollama…"
docker compose up -d --build

echo
green "Aura's backend is starting on http://localhost:8000"
echo
echo "The first run downloads the Whisper weights (~1.5 GB) and the Ollama"
echo "model, so the first recording will be slow. Both are cached afterwards."
echo
echo "  Health:   curl http://localhost:8000/api/v1/health"
echo "  Logs:     docker compose logs -f backend"
echo "  Stop:     docker compose down"
echo
echo "Frontend:   cd frontend && npm install && npm run dev"
echo
yellow "Reminder: NEXT_PUBLIC_API_URL is baked into the frontend at BUILD time"
yellow "(it drives the CSP). If you change it, rebuild the frontend."
