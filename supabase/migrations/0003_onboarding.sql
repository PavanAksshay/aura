-- ============================================================================
-- 0003: Onboarding fields for the Aura multi-step intake flow.
-- Additive-only: safe to run on a live project that already has 0001/0002.
-- `clinic_name` (from 0001) is reused as the practice name.
-- ============================================================================

alter table public.profiles
  add column if not exists title            text,
  add column if not exists practice_type    text,
  add column if not exists specializations  text[] not null default '{}',
  add column if not exists years_experience smallint,
  add column if not exists onboarded        boolean not null default false;

comment on column public.profiles.onboarded is
  'True once the clinician completes the intake flow; gates the workspace.';

-- Keep updated_at fresh on profile edits (touch_updated_at ships in 0002).
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();
