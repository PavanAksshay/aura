-- ============================================================================
-- 0001: Psychologist profiles
-- One row per authenticated clinician, keyed 1:1 to auth.users.
-- RLS: a user can only ever see and edit their own profile row.
-- ============================================================================

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  clinic_name text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.profiles is
  'Clinician profile, auto-created on signup. Contains no patient data.';

alter table public.profiles enable row level security;

-- Owner-only access. No delete policy: profile lifecycle follows auth.users
-- via the FK cascade, never a client-side delete.
create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check ((select auth.uid()) = id);

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Auto-provision a profile whenever a new auth user is created.
-- SECURITY DEFINER with a pinned empty search_path: the standard hardened
-- pattern for triggers that write across schemas.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
