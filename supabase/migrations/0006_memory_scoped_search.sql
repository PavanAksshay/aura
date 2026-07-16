-- ============================================================================
-- 0006: Service-role-only scoped memory search.
--
-- The FastAPI backend performs memory searches with the service role, which
-- BYPASSES row-level security — so the RLS-reliant match_note_chunks() from
-- 0005 is not safe for it to call. This function bakes the (JWT-verified)
-- user id into the WHERE clause instead, and is executable ONLY by the
-- service role: clients cannot call it with someone else's id.
-- ============================================================================

create or replace function public.match_note_chunks_scoped(
  p_user_id       uuid,
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
security definer
set search_path = public, extensions
as $$
  select
    ne.session_id,
    ne.patient_id,
    ne.chunk_index,
    ne.content,
    1 - (ne.embedding <=> query_embedding) as similarity
  from public.note_embeddings ne
  where ne.user_id = p_user_id
    and (filter_patient is null or ne.patient_id = filter_patient)
  order by ne.embedding <=> query_embedding
  limit least(greatest(match_count, 1), 50);
$$;

-- Lock it down: only the backend (service role) may execute.
revoke execute on function public.match_note_chunks_scoped(
  uuid, extensions.vector, int, uuid
) from public, anon, authenticated;

grant execute on function public.match_note_chunks_scoped(
  uuid, extensions.vector, int, uuid
) to service_role;
