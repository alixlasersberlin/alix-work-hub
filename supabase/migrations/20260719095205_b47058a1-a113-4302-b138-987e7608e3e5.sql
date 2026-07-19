-- AlixDocs: Volltext-Snippets + Retention-Extensions
-- 1. Add tsvector index for OCR full-text search (German)
ALTER TABLE public.alixdocs_documents
  ADD COLUMN IF NOT EXISTS search_tsv tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('german', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('german', coalesce(ai_summary, '')), 'B') ||
    setweight(to_tsvector('german', coalesce(ocr_text, '')), 'C') ||
    setweight(to_tsvector('german', coalesce(description, '')), 'D')
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_alixdocs_search_tsv ON public.alixdocs_documents USING gin(search_tsv);

-- 2. Snippet-Suche RPC (nutzt bestehende RLS via SECURITY INVOKER)
CREATE OR REPLACE FUNCTION public.alixdocs_search_snippets(
  q text,
  max_rows int DEFAULT 200
)
RETURNS TABLE (
  id uuid,
  snippet text,
  rank real
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    d.id,
    ts_headline(
      'german',
      coalesce(nullif(d.ocr_text, ''), coalesce(d.ai_summary, d.title)),
      websearch_to_tsquery('german', q),
      'MaxWords=28, MinWords=12, ShortWord=3, HighlightAll=false, MaxFragments=2, FragmentDelimiter=" … ", StartSel=<<, StopSel=>>'
    ) AS snippet,
    ts_rank(d.search_tsv, websearch_to_tsquery('german', q)) AS rank
  FROM public.alixdocs_documents d
  WHERE d.deleted_at IS NULL
    AND d.search_tsv @@ websearch_to_tsquery('german', q)
  ORDER BY rank DESC
  LIMIT max_rows;
$$;

GRANT EXECUTE ON FUNCTION public.alixdocs_search_snippets(text, int) TO authenticated;

-- 3. Retention: neue Spalten für auto-delete-nach-Archiv
ALTER TABLE public.alixdocs_categories
  ADD COLUMN IF NOT EXISTS delete_after_archive_days int;

-- 4. Kommentar zur Nutzung
COMMENT ON COLUMN public.alixdocs_categories.delete_after_archive_days IS
  'Nach so vielen Tagen im Status "archiviert" wird das Dokument automatisch soft-deleted (deleted_at gesetzt). NULL = nie.';