-- ============================================================================
-- 0019: Daily AI usage counters.
--
-- Additive-only; safe to run on a live project.
--
-- WHY A TABLE AND NOT MEMORY: every Ollama call runs on one person's laptop,
-- so usage by other clinicians is a real cost borne by the operator. The
-- existing rate limiter lives in process memory, which is fine for smoothing
-- bursts but useless as a quota — the backend restarts often (it is a dev
-- machine behind a tunnel), and every restart would silently reset everyone's
-- allowance. A quota that resets whenever the owner reboots is not a quota.
--
-- The owner's own account is exempt in application code, not here, so the
-- exemption is driven by the JWT-verified email rather than by data anyone
-- could edit.
-- ============================================================================

create table if not exists public.ai_usage (
  user_id    uuid        not null references auth.users(id) on delete cascade,
  -- UTC day. Deliberately not the clinician's local day: the counter is about
  -- the operator's compute, and a single global reset is easier to reason
  -- about than one that varies by timezone.
  usage_date date        not null default (now() at time zone 'utc')::date,
  count      integer     not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, usage_date)
);

comment on table public.ai_usage is
  'Per-user, per-UTC-day count of local-LLM calls. Enforced in the backend; the owner is exempt.';

alter table public.ai_usage enable row level security;

-- Users may read their own usage (so the UI can show what is left). Writes go
-- through the service role only — a client that could increment its own
-- counter could equally reset it.
drop policy if exists "ai_usage_select_own" on public.ai_usage;
create policy "ai_usage_select_own"
  on public.ai_usage for select
  using (auth.uid() = user_id);

-- Atomic increment + read in one round trip, so two concurrent requests cannot
-- both read the same count and each write count+1.
create or replace function public.bump_ai_usage(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_count integer;
begin
  insert into public.ai_usage (user_id, usage_date, count, updated_at)
  values (p_user_id, (now() at time zone 'utc')::date, 1, now())
  on conflict (user_id, usage_date) do update
    set count = public.ai_usage.count + 1,
        updated_at = now()
  returning count into new_count;
  return new_count;
end;
$$;

-- Backend only: a client that could call this could burn its own quota, or
-- worse, someone else's.
revoke execute on function public.bump_ai_usage(uuid) from public, anon, authenticated;
grant execute on function public.bump_ai_usage(uuid) to service_role;
