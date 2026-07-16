-- ============================================================================
-- 0015: Persistent Patient Memory chats.
-- A chat belongs to one clinician and (optionally) one patient category; its
-- messages are the Q&A turns. Chats survive tab switches and sign-outs — the
-- clinician deletes them explicitly. Deleting a chat cascades to its messages;
-- deleting a patient detaches their chats (set null → "General") rather than
-- destroying the clinician's notes-about-notes.
-- ============================================================================

create table public.memory_chats (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  patient_id  uuid references public.patients (id) on delete set null,
  title       text not null default 'New chat',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.memory_chats is
  'Patient Memory Q&A threads, grouped per patient. Owner-only via RLS.';

create index memory_chats_user_updated_idx
  on public.memory_chats (user_id, updated_at desc);

create table public.memory_messages (
  id          uuid primary key default gen_random_uuid(),
  chat_id     uuid not null references public.memory_chats (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  role        text not null check (role in ('user', 'assistant')),
  content     text not null,
  -- Answer provenance (assistant turns only): which engine answered and the
  -- supporting note excerpts, so past answers keep their sources.
  engine      text,
  matches     jsonb,
  created_at  timestamptz not null default now()
);

comment on table public.memory_messages is
  'Turns within a memory chat. Owner-only via RLS; matches holds the supporting excerpts an answer cited.';

create index memory_messages_chat_idx
  on public.memory_messages (chat_id, created_at);

alter table public.memory_chats enable row level security;
alter table public.memory_messages enable row level security;

create policy "memory_chats_select_own" on public.memory_chats
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "memory_chats_insert_own" on public.memory_chats
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "memory_chats_update_own" on public.memory_chats
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "memory_chats_delete_own" on public.memory_chats
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "memory_messages_select_own" on public.memory_messages
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "memory_messages_insert_own" on public.memory_messages
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "memory_messages_delete_own" on public.memory_messages
  for delete to authenticated using ((select auth.uid()) = user_id);
