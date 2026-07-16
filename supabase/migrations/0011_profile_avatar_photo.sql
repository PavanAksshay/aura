-- ============================================================================
-- 0011: Optional custom profile photo.
-- Clinicians may upload their own photo instead of using a generated inkblot.
-- The bytes live in a PRIVATE `avatars` bucket, owner-scoped by the leading
-- path segment (<uid>/...); `profiles.avatar_url` stores the object path. When
-- set it takes precedence over `avatar_id` (the inkblot).
-- ============================================================================

alter table public.profiles
  add column if not exists avatar_url text;

comment on column public.profiles.avatar_url is
  'Object path in the private avatars bucket for a custom profile photo; null = use the inkblot avatar_id.';

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', false)
on conflict (id) do nothing;

create policy "avatars_select_own"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "avatars_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "avatars_update_own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "avatars_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
