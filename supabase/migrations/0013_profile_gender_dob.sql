-- ============================================================================
-- 0013: Clinician gender + date of birth, collected at intake.
-- These describe the account holder (the clinician), not a patient — patient
-- demographics live on public.patients. Both are optional: gender is free text
-- rather than an enum so the intake options can grow without a migration, and
-- "Prefer not to say" is a first-class answer that simply stores null.
-- ============================================================================

alter table public.profiles
  add column if not exists gender text,
  add column if not exists date_of_birth date;

comment on column public.profiles.gender is
  'Clinician-reported gender; free text from the intake options. Null = not shared.';

comment on column public.profiles.date_of_birth is
  'Clinician date of birth. Null = not shared.';
