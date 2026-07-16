-- ============================================================================
-- 0012: Background appointment reminders via Web Push.
-- A clinician may register one or more browser push subscriptions (one per
-- device/browser). The backend scheduler reads these with the service role and
-- pushes a reminder ~10 minutes before each appointment — which is what lets a
-- reminder arrive when Aura isn't open in a tab.
--
-- `appointments.reminder_sent_at` makes the send idempotent: the scheduler only
-- picks up rows where it is null, then stamps it.
-- ============================================================================

create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  -- The push service URL is the subscription's natural identity; re-subscribing
  -- the same browser must update, not duplicate.
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now()
);

comment on table public.push_subscriptions is
  'Browser Web Push subscriptions per clinician. Owner-only via RLS; the reminder scheduler reads these with the service role.';

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

create policy "push_subscriptions_select_own"
  on public.push_subscriptions for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "push_subscriptions_insert_own"
  on public.push_subscriptions for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "push_subscriptions_update_own"
  on public.push_subscriptions for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "push_subscriptions_delete_own"
  on public.push_subscriptions for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- Idempotency stamp for the reminder scheduler.
alter table public.appointments
  add column if not exists reminder_sent_at timestamptz;

comment on column public.appointments.reminder_sent_at is
  'Set when the pre-appointment push reminder was delivered; null = not yet sent.';

-- The scheduler's hot query: unsent reminders in a small time window.
create index if not exists appointments_reminder_due_idx
  on public.appointments (starts_at)
  where reminder_sent_at is null and status = 'scheduled';
