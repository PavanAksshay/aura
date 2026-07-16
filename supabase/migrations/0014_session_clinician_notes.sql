-- ============================================================================
-- 0014: Free-text clinician notes on a session.
-- The SOAP note is machine-generated from the transcript; this is the
-- therapist's own space — reflections, follow-ups, things worth remembering
-- that the recording never captured. Owner-only via the existing sessions RLS
-- (0002); no new policies needed since it's a column on an already-scoped row.
-- ============================================================================

alter table public.sessions
  add column if not exists clinician_notes text;

comment on column public.sessions.clinician_notes is
  'Therapist-authored free-text notes for this session. Distinct from soap (generated) and raw_transcript (verbatim).';
