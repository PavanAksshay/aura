-- ============================================================================
-- 0010: Profile personalization + gamification.
-- Adds an onboarding avatar, a login-streak tracker, and an earned-badge set
-- to the clinician profile. All additive and owner-scoped under the existing
-- profiles RLS (0001). No patient data is involved.
-- ============================================================================

alter table public.profiles
  -- Which of the 20 built-in avatars the clinician picked at onboarding.
  add column if not exists avatar_id text,
  -- Consecutive-day login streak, refreshed by record_activity().
  add column if not exists current_streak integer not null default 0,
  add column if not exists longest_streak integer not null default 0,
  add column if not exists last_active_on date,
  -- Badge ids the clinician has already been awarded; used to fire the
  -- "achievement unlocked" toast only once per badge.
  add column if not exists earned_badges text[] not null default '{}',
  -- Stamped when they accept the privacy note at the end of onboarding.
  add column if not exists privacy_accepted_at timestamptz;

-- ----------------------------------------------------------------------------
-- record_activity(): idempotent per day. Advances the streak when the last
-- active day was yesterday, resets it when there was a gap, and no-ops when
-- already recorded today. SECURITY DEFINER so it can update regardless of the
-- caller's RLS posture, but it only ever touches the caller's own row.
-- ----------------------------------------------------------------------------
create or replace function public.record_activity()
returns table (current_streak integer, longest_streak integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  last_on date;
  streak integer;
  longest integer;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  select p.last_active_on, p.current_streak, p.longest_streak
    into last_on, streak, longest
  from public.profiles p
  where p.id = uid
  for update;

  if last_on is null or last_on < current_date - 1 then
    streak := 1;                       -- first day, or streak broken
  elsif last_on = current_date - 1 then
    streak := coalesce(streak, 0) + 1; -- consecutive day
  end if;
  -- last_on = current_date falls through: streak unchanged (already counted).

  longest := greatest(coalesce(longest, 0), streak);

  update public.profiles p
     set current_streak = streak,
         longest_streak = longest,
         last_active_on = current_date
   where p.id = uid;

  return query select streak, longest;
end;
$$;

comment on function public.record_activity is
  'Refreshes the caller''s login streak for today; safe to call on every load.';
