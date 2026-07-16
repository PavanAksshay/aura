-- ============================================================================
-- 0005: Patient Memory — pgvector semantic index over exported note text.
--
-- Embeddings are 768-dim (nomic-embed-text-v1.5, computed locally in the
-- FastAPI backend — no external AI calls). Only *structured note* text is
-- ever embedded; raw transcripts remain ephemeral and are never indexed.
--
-- Writes happen exclusively through the backend (service role). Clients get
-- read-only access to their own rows, and the similarity search function is
-- SECURITY INVOKER so RLS keeps applying to whoever calls it.
-- ============================================================================

create extension if not exists vector with schema extensions;

create table public.note_embeddings (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  session_id  uuid not null references public.sessions (id) on delete cascade,
  patient_id  uuid references public.patients (id) on delete set null,
  chunk_index int  not null,
  content     text not null,
  embedding   extensions.vector(768) not null,
  created_at  timestamptz not null default now(),
  unique (session_id, chunk_index)
);

comment on table public.note_embeddings is
  'Chunked structured-note text + local embeddings for semantic recall. Never contains raw-transcript content.';

alter table public.note_embeddings enable row level security;

-- Read-only for owners; no client-side insert/update/delete policies exist,
-- so those verbs are denied by default. The backend writes via service role.
create policy "note_embeddings_select_own"
  on public.note_embeddings for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- Approximate-nearest-neighbour index (cosine). HNSW: better recall than
-- IVFFlat at this scale and no training step required.
create index note_embeddings_hnsw_idx
  on public.note_embeddings
  using hnsw (embedding extensions.vector_cosine_ops);

create index note_embeddings_user_patient_idx
  on public.note_embeddings (user_id, patient_id);

-- Owner-scoped semantic search. SECURITY INVOKER: the caller's RLS applies,
-- so the function can only ever surface the caller's own chunks.
create or replace function public.match_note_chunks(
  query_embedding extensions.vector(768),
  match_count     int  default 8,
  filter_patient  uuid default null
)
returns table (
  session_id  uuid,
  patient_id  uuid,
  chunk_index int,
  content     text,
  similarity  double precision
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select
    ne.session_id,
    ne.patient_id,
    ne.chunk_index,
    ne.content,
    1 - (ne.embedding <=> query_embedding) as similarity
  from public.note_embeddings ne
  where filter_patient is null or ne.patient_id = filter_patient
  order by ne.embedding <=> query_embedding
  limit least(greatest(match_count, 1), 50);
$$;
