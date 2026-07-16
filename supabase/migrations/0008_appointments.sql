-- ============================================================================
-- 0008: Appointment scheduling.
-- Each appointment belongs to exactly one clinician (user_id) and may point at
-- a patient on their roster. RLS on every verb mirrors patients (0004): no
-- clinician can read, write, or infer another's schedule. The patient link is
-- nullable and set-null on delete so removing someone from the roster never
-- destroys the calendar history around them.
-- ============================================================================

create table public.appointments (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  patient_id  uuid references public.patients (id) on delete set null,
  title       text not null,
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  location    text,
  notes       text,
  status      text not null default 'scheduled'
              check (status in ('scheduled', 'completed', 'cancelled')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- An appointment cannot end before it begins.
  constraint appointments_time_order check (ends_at >= starts_at)
);

comment on table public.appointments is
  'Clinician-owned appointment calendar. Owner-only via RLS; service-role writes must always scope by user_id.';

-- Agenda queries are "my appointments, in time order": index accordingly.
create index appointments_user_starts_idx
  on public.appointments (user_id, starts_at);

-- Patient-profile lookups ("this person's upcoming/past sessions").
create index appointments_patient_starts_idx
  on public.appointments (patient_id, starts_at desc);

alter table public.appointments enable row level security;

create policy "appointments_select_own"
  on public.appointments for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "appointments_insert_own"
  on public.appointments for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "appointments_update_own"
  on public.appointments for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "appointments_delete_own"
  on public.appointments for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create trigger appointments_touch_updated_at
  before update on public.appointments
  for each row execute function public.touch_updated_at();
