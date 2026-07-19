-- ============================================================================
-- 0017: Clinician review attestation on generated notes.
--
-- Additive-only; safe to run on a live project.
--
-- WHY: the note in every session is drafted by a 3B local model and then
-- auto-exported and indexed into Memory the moment transcription finishes —
-- no human sees it first. That is a deliberate product choice (it keeps the
-- clinician out of a queue), but it means the record cannot currently
-- distinguish "a machine wrote this" from "a clinician read it and agrees".
--
-- These columns record that distinction. They do NOT gate export; they make
-- the review state explicit and auditable, so an unreviewed AI draft is never
-- mistaken for a verified clinical record.
-- ============================================================================

alter table public.sessions
  add column if not exists reviewed_at timestamptz,
  -- Denormalised on purpose: who attested, even if the profile changes later.
  add column if not exists reviewed_by uuid references auth.users(id);

comment on column public.sessions.reviewed_at is
  'When a clinician confirmed the generated note is accurate. NULL = AI draft, unverified.';
comment on column public.sessions.reviewed_by is
  'The clinician who attested to the note''s accuracy.';

-- Finding unreviewed sessions is the common dashboard query.
create index if not exists sessions_unreviewed_idx
  on public.sessions (user_id, created_at desc)
  where reviewed_at is null;

-- RLS: existing per-owner policies on public.sessions already cover these
-- columns (they are not separately grantable), so no policy changes are needed.
