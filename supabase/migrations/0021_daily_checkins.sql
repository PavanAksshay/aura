-- ============================================================================
-- 0021: Daily well-being check-in with an owner reply loop.
--
-- Additive-only; safe to run on a live project.
--
-- WHY: a specific user is greeted once per day after onboarding and can leave a
-- short message; the operator is notified, reads it in an owner-only inbox, and
-- replies. One row per user per (local) day holds the mood, her optional
-- message, and the operator's reply.
--
-- Access model: the user manages her own rows under RLS. The operator reads
-- every user's messages and writes replies through the backend using the
-- service role (which bypasses RLS), gated on owner_email in the API — there is
-- deliberately no RLS policy granting cross-user reads to normal clients.
-- ============================================================================

create table if not exists public.daily_checkins (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  -- The user's LOCAL calendar day, supplied by the client, so "once per day"
  -- follows her timezone rather than the server's.
  checkin_date      date not null,
  mood              text not null,
  message           text,
  owner_reply       text,
  owner_replied_at  timestamptz,
  reply_seen_at     timestamptz,
  created_at        timestamptz not null default now(),
  unique (user_id, checkin_date)
);

comment on table public.daily_checkins is
  'One well-being check-in per user per local day, plus the operator''s reply.';

create index if not exists daily_checkins_user_day_idx
  on public.daily_checkins (user_id, checkin_date desc);

-- Inbox scan for the operator: unreplied messages first, newest first. Partial
-- index keeps it tiny — most rows have no message.
create index if not exists daily_checkins_pending_idx
  on public.daily_checkins (created_at desc)
  where message is not null and owner_reply is null;

alter table public.daily_checkins enable row level security;

-- A user sees and manages only her own check-ins. The operator's cross-user
-- access goes through the backend service role, not these policies.
create policy "daily_checkins_select_own" on public.daily_checkins
  for select using (user_id = auth.uid());

create policy "daily_checkins_insert_own" on public.daily_checkins
  for insert with check (user_id = auth.uid());

create policy "daily_checkins_update_own" on public.daily_checkins
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
