-- ============================================================================
-- 0016: SOAP → a two-section session note.
-- The generated note is now {"discussed": [...], "ahead": [...]} — "What was
-- discussed" and "What lies ahead" — instead of the four SOAP buckets, which a
-- therapy dialogue rarely fit (misaligned transcript fragments and empty
-- "No … identified." sections).
--
-- The column is jsonb, so this is a rename only: existing rows keep their SOAP
-- payload and are read through a compatibility shim (app/services/note.py
-- parse_note), which folds subjective/objective/assessment → discussed and
-- plan → ahead. No data is rewritten or lost.
-- ============================================================================

alter table public.sessions rename column soap to note;

comment on column public.sessions.note is
  'Generated session note: {"discussed": [bullets], "ahead": [bullets]}. Older rows may still hold the legacy SOAP shape and are parsed compatibly.';
