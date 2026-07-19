-- ============================================================================
-- 0018: Let clinicians correct a generated note.
--
-- Additive-only; safe to run on a live project.
--
-- WHY: until now a wrong note could not be fixed. The "Regenerate" control on
-- the session page only rebuilt the *summary*; the note itself — the thing
-- that is indexed into Memory and read as the clinical record — had no edit
-- path at all. Measured transcription behaviour makes that untenable: the
-- pipeline fabricated text and inverted clinical meaning on hard audio (see
-- backend/scripts/accuracy/README.md), so the clinician must be able to
-- correct the record rather than only attest to it or discard it.
-- ============================================================================

alter table public.sessions
  add column if not exists note_edited_at timestamptz;

comment on column public.sessions.note_edited_at is
  'When a clinician last hand-edited the generated note. NULL = still as drafted.';

-- RLS: the existing per-owner policies on public.sessions cover this column;
-- columns are not separately grantable, so no policy change is required.
