-- ============================================================================
-- 0002: Clinical sessions
-- Holds the transcription pipeline state, the EPHEMERAL raw transcript, and
-- the structured SOAP note. Raw patient audio NEVER touches the database —
-- it exists only in the backend's scratch directory during inference.
--
-- Data lifecycle:
--   processing -> ready            (raw_transcript + soap populated)
--   ready      -> exported         (raw_transcript is NULLed at export time
--                                   by the backend; only the clinician-owned
--                                   SOAP note survives)
--
-- RLS: strict owner isolation. Every policy is scoped to `authenticated` and
-- compares auth.uid() to user_id, so no clinician can read, create, modify,
-- or delete another clinician's records. The backend uses the service-role
-- key (bypasses RLS) to drive status transitions and the purge step.
-- ============================================================================

create type public.session_status as enum (
  'processing',  -- audio received, Whisper/SOAP pipeline running
  'ready',       -- transcript + SOAP note available for review
  'exported',    -- note exported; raw transcript purged
  'failed'       -- pipeline error; no transcript retained
);

create table public.sessions (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references public.profiles (id) on delete cascade,
  title                  text not null default 'Untitled session',
  status                 public.session_status not null default 'processing',
  audio_duration_seconds integer check (audio_duration_seconds >= 0),

  -- EPHEMERAL: unedited Whisper output. Set to NULL by the backend the
  -- moment the structured note is exported. Never rely on it persisting.
  raw_transcript         text,

  -- Structured note: { "subjective": "...", "objective": "...",
  --                    "assessment": "...", "plan": "..." }
  soap                   jsonb,

  error_detail           text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  exported_at            timestamptz
);

comment on column public.sessions.raw_transcript is
  'Ephemeral. Purged (set NULL) when the SOAP note is exported.';

create index sessions_user_created_idx
  on public.sessions (user_id, created_at desc);

alter table public.sessions enable row level security;

create policy "sessions_select_own"
  on public.sessions for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "sessions_insert_own"
  on public.sessions for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "sessions_update_own"
  on public.sessions for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "sessions_delete_own"
  on public.sessions for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- Keep updated_at honest on every write.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger sessions_touch_updated_at
  before update on public.sessions
  for each row execute function public.touch_updated_at();
