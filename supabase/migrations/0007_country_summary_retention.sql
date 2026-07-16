-- ============================================================================
-- 0007: Onboarding location, session summaries, and transcript retention.
--
-- Additive-only; safe to run on a live project.
--
-- NOTE ON PRIVACY: earlier the raw transcript was purged at export. Per an
-- explicit product decision, transcripts are now RETAINED so they can be
-- viewed, downloaded, and summarized after export. The backend no longer
-- NULLs sessions.raw_transcript. (Audio remains ephemeral either way — it is
-- still deleted the moment transcription finishes and never hits the DB.)
-- ============================================================================

-- Clinician location → drives the timezone used when they plan calendar slots.
alter table public.profiles
  add column if not exists country  text,
  add column if not exists timezone text;

-- Persisted, on-demand structured summary of a session's transcript:
--   { "patient_name": "...", "age": "...", "personal_details": "...",
--     "discussion": "...", "engine": "ollama|heuristic" }
alter table public.sessions
  add column if not exists summary jsonb;

comment on column public.sessions.raw_transcript is
  'Retained transcript (as of 0007). Audio is still ephemeral; only the note '
  'and transcript persist. Purged only if the session row is deleted.';
