-- ============================================================================
-- 0004: Patient roster.
-- Each patient belongs to exactly one psychologist (user_id). RLS on every
-- verb: no clinician can read, write, or infer the existence of another's
-- patients. Sessions gain an optional patient link.
-- ============================================================================

create table public.patients (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  full_name   text not null,
  -- Optional clinical context; all owner-visible only under RLS.
  date_of_birth date,
  pronouns    text,
  contact_email text,
  contact_phone text,
  presenting_concerns text,
  status      text not null default 'active'
              check (status in ('active', 'paused', 'discharged')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.patients is
  'Clinician-owned patient roster. Owner-only via RLS; service-role writes must always scope by user_id.';

create index patients_user_created_idx
  on public.patients (user_id, created_at desc);

alter table public.patients enable row level security;

create policy "patients_select_own"
  on public.patients for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "patients_insert_own"
  on public.patients for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "patients_update_own"
  on public.patients for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "patients_delete_own"
  on public.patients for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create trigger patients_touch_updated_at
  before update on public.patients
  for each row execute function public.touch_updated_at();

-- Link sessions to patients. Nullable: quick unattributed recordings stay
-- possible; set null on patient delete so session notes survive roster edits.
alter table public.sessions
  add column patient_id uuid references public.patients (id) on delete set null;

create index sessions_patient_idx
  on public.sessions (patient_id, created_at desc);
