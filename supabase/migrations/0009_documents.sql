-- ============================================================================
-- 0009: Patient document storage.
-- A `documents` row is metadata; the bytes live in a PRIVATE Storage bucket.
-- Both layers are owner-scoped:
--   * the table via RLS on user_id (mirrors patients / appointments), and
--   * the bucket via storage.objects policies that pin the FIRST path segment
--     to the caller's uid — every object lives under `<uid>/...`, so one
--     clinician can never list or fetch another's files.
-- Files are uploaded straight from the browser client under these policies;
-- there is no server round-trip (see PatientDocuments.tsx).
-- ============================================================================

create table public.documents (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  patient_id   uuid references public.patients (id) on delete set null,
  file_name    text not null,
  -- Path within the bucket: `<user_id>/<patient_id>/<uuid>-<name>`. Unique so
  -- a metadata row maps to exactly one object.
  storage_path text not null unique,
  mime_type    text,
  size_bytes   bigint,
  created_at   timestamptz not null default now()
);

comment on table public.documents is
  'Metadata for files in the private patient-documents bucket. Owner-only via RLS.';

create index documents_user_created_idx
  on public.documents (user_id, created_at desc);

create index documents_patient_created_idx
  on public.documents (patient_id, created_at desc);

alter table public.documents enable row level security;

create policy "documents_select_own"
  on public.documents for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "documents_insert_own"
  on public.documents for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "documents_delete_own"
  on public.documents for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- ----------------------------------------------------------------------------
-- Private storage bucket + per-user folder policies.
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('patient-documents', 'patient-documents', false)
on conflict (id) do nothing;

-- Each policy pins the leading folder of the object name to the caller's uid.
-- storage.foldername(name) splits the path on '/'; [1] is the first segment.
create policy "patient_docs_select_own"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'patient-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "patient_docs_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'patient-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "patient_docs_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'patient-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
