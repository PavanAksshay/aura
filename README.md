# Aura — Clinical Scribe Workspace

Privacy-first session documentation for clinical psychologists. Record a
session, have it transcribed **locally** with Whisper large-v3 (with speaker
labels), get a structured note and summary automatically, and ask
plain-language questions of your own notes through a private semantic
**Patient Memory**.

Every AI step — transcription, diarization, embeddings, summarization —
runs on your own machine. No OpenAI, no Google, no speech API.

## Scale: this is a single-clinician tool

Stated plainly, because it is easy to assume otherwise and expensive to find
out late.

Aura's privacy model and its capacity are the same fact: every AI step runs on
one machine, so that machine is the ceiling. Measured on an 8 GB M1 with
Whisper large-v3 int8:

| | |
|---|---|
| Transcription speed | **4.2x realtime** idle, **8.5x** under light CPU contention |
| A 50-minute session | ~3.5 hours to produce a note |
| Concurrent jobs | **1** — further uploads queue (`MAX_CONCURRENT_TRANSCRIPTIONS`) |

Raising the concurrency limit does not increase throughput. Each job holds a
Whisper model, a pyannote pass and an Ollama call; running several at once
makes all of them slower and can exhaust memory, killing jobs that were nearly
finished. Queueing is the honest behaviour.

**There is no container image or cloud deployment, deliberately.** Moving
transcription to a rented GPU would make long sessions finish in minutes, but
it would also mean patient audio leaving the clinician's machine — which is
the one promise Aura makes that cloud-based scribes cannot. If that trade is
ever worth making, the public claims in this README, on the landing page and
in the privacy policy must all change first, and cross-border transfer of
health data becomes a live legal question (see `docs/regulatory-brief.md`).

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router, RSC), Tailwind CSS v4, shadcn-style components, framer-motion, react-three-fiber |
| Backend | Python 3.12, FastAPI, Uvicorn |
| Auth + DB | Supabase (Postgres with Row Level Security + pgvector) |
| Transcription | Whisper **large-v3** via faster-whisper (CTranslate2, CPU int8) |
| Diarization | pyannote.audio (speaker-labelled transcripts; optional, degrades gracefully) |
| Summaries + memory Q&A | Ollama (`llama3.2:3b`) locally, with a deterministic fallback |
| Memory embeddings | nomic-embed-text-v1.5 via fastembed (ONNX, 768-dim, local) |

## Data-lifecycle policy

1. **Raw audio is ephemeral.** It exists only in the browser during capture
   and in the backend's scratch directory during inference. The pipeline
   deletes it in a `finally` block
   ([retention.py](backend/app/services/retention.py)) — on success *or*
   failure — and the scratch dir is swept on server start and stop. Audio is
   never stored in the database or in object storage.
2. **Transcripts are retained.** `sessions.raw_transcript` persists so the
   clinician can review, search, download, and summarize a session later.
   (This reverses an earlier purge-on-export design — see migration 0007.)
3. **Notes are finalized automatically.** When transcription completes, the
   pipeline also generates the summary, marks the session exported, and
   indexes the note into Patient Memory — only note text is embedded, never
   raw audio.
4. **Isolation.** RLS scopes every row to `auth.uid()`. The backend verifies
   the Supabase JWT (ES256 via JWKS) on every request, and the memory search
   function it calls is service-role-only and hard-scoped to the verified
   caller. All service-role writes are explicitly scoped by user id.
5. **Local-only inference.** Transcription, diarization, embeddings, and
   summarization all run in-process or against a local Ollama.

> Aura is a documentation aid, not a medical device. Generated notes are
> drafts for clinician review — see [Terms](frontend/app/terms/page.tsx).

## Features

- **Recording** with a live waveform, background transcription, and progress polling
- **Speaker-labelled transcripts** (`Speaker 1/2`) via pyannote
- **Patients** roster grouped by status, with per-patient session history,
  documents, and free-text clinician notes
- **Patient Memory** — ask a question, get a specific answer synthesized from
  your own notes, with supporting excerpts
- **Scheduling** with appointment reminders (in-app, plus Web Push that
  arrives with the app closed)
- **PDF export** of transcripts and summaries
- **Profile** with streaks, achievements, generated Rorschach-inkblot avatars,
  and optional photo upload
- **Light/dark theme**, defaulting to your local time of day

## Repository layout

- `frontend/` — Next.js app (landing, auth, onboarding, dashboard, patients,
  schedule, memory, recorder, note review, profile, privacy/terms)
- `backend/` — FastAPI service (`app/api` routes, `app/services` pipeline)
- `supabase/migrations/` — schema, RLS, pgvector, storage buckets, applied in
  order (**0001–0014**)

## Setup

### 1. Supabase

Create a project, then run every migration in `supabase/migrations/` **in
order** (SQL editor, or `supabase db push`). Collect: project URL, anon key,
service-role key.

### 2. Backend

```bash
cd backend
python3.12 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev,ml]"        # ml extra pulls faster-whisper + fastembed
cp .env.example .env               # fill in Supabase values
uvicorn app.main:app --reload --port 8000
```

Whisper large-v3 weights (~1.5 GB) and the embedding model download from
Hugging Face on first use and are cached locally. CPU transcription takes a
while — the app is built around that (background pipeline + polling UI).

Optional extras:

- **Diarization**: `pip install -e ".[diarization]"`, accept the pyannote model
  terms on Hugging Face, and set `HF_TOKEN`. Without it, transcripts are still
  produced, just unlabelled.
- **Summaries / memory answers**: run [Ollama](https://ollama.com) and
  `ollama pull llama3.2:3b`. Without it, a deterministic fallback is used.
- **Push reminders**: generate a VAPID keypair and set `VAPID_PUBLIC_KEY` /
  `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` (the public key also goes in the
  frontend as `NEXT_PUBLIC_VAPID_PUBLIC_KEY`).

Set `ENVIRONMENT=production` when deploying to disable the interactive API docs.

Checks: `ruff check app tests && mypy app && pytest`

### 3. Frontend

```bash
cd frontend
npm install
cp .env.example .env.local         # Supabase URL/anon key, API URL, VAPID public key
npm run dev
```

Checks: `npm run lint && npm run build`

### 4. Flow

Sign up → onboarding → add patients → **New session** (link a patient) →
record with the live waveform → **Generate note**. Transcription runs in the
background; you're notified when the note is ready. The summary is generated
and the note indexed into **Memory** automatically, where you can ask things
like *"what coping strategies have we already tried?"*.

## Architecture notes

- Audio uploads go browser → FastAPI directly (multipart, bearer-authed with
  the user's Supabase access token). They never transit Supabase storage, so
  there is exactly one purge point to audit.
- Ordinary CRUD (patients, appointments, documents, notes) goes straight to
  Supabase under RLS. The backend exists only for work that needs a model or
  policy authority: transcription, embeddings, LLM calls, status transitions.
- Memory search: query embedded locally → `match_note_chunks_scoped()`
  (service-role-only, user id baked into the `WHERE`) → cosine HNSW.
- The expensive endpoints are rate-limited per user
  ([ratelimit.py](backend/app/core/ratelimit.py)); the frontend sets baseline
  security headers and a CSP built from the configured origins.
- SOAP structuring is a deterministic, in-process heuristic
  ([soap.py](backend/app/services/soap.py)); `build_soap_note` is the seam to
  swap in a stronger (still local) structurer later.
