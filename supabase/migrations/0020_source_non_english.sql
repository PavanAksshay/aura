-- ============================================================================
-- 0020: Record whether a session was spoken in a non-English language.
--
-- Additive-only; safe to run on a live project.
--
-- WHY: Tamil/Hindi sessions are summarised into English, so the note is a
-- translation and the "review with extra care" banner must show. The frontend
-- used to infer this from the transcript text, but once transcripts are
-- romanized to the Latin alphabet (app/services/romanize.py) that inference is
-- fragile — the romanized spellings do not reliably match the detector. The
-- backend already knows the answer at transcription time, from the ORIGINAL
-- script, so it stamps it here and the UI simply trusts it. Existing rows
-- default to false and keep falling back to text-detection in the client.
-- ============================================================================

alter table public.sessions
  add column if not exists source_non_english boolean not null default false;

comment on column public.sessions.source_non_english is
  'True when the session was transcribed in a non-English language (e.g. Tamil, '
  'Hindi) and the note is therefore an English translation. Set by the pipeline '
  'from the original transcript, before any romanization.';

-- RLS: the existing per-owner policies on public.sessions cover this column;
-- columns are not separately grantable, so no policy change is required.
