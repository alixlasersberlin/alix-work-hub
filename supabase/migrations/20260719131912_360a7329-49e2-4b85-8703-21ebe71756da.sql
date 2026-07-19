
CREATE OR REPLACE FUNCTION public.alixdocs_fts_search(_query text, _limit int DEFAULT 15)
RETURNS TABLE (
  id uuid,
  title text,
  original_filename text,
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
    d.title,
    d.original_filename,
    ts_headline(
      'german',
      coalesce(d.ocr_text, coalesce(d.title,'') || ' ' || coalesce(d.description,'')),
      plainto_tsquery('german', _query),
      'MaxWords=45, MinWords=15, ShortWord=3, HighlightAll=false, MaxFragments=2, FragmentDelimiter=" … "'
    ) AS snippet,
    ts_rank(d.search_tsv, plainto_tsquery('german', _query)) AS rank
  FROM public.alixdocs_documents d
  WHERE d.deleted_at IS NULL
    AND d.search_tsv @@ plainto_tsquery('german', _query)
  ORDER BY rank DESC NULLS LAST
  LIMIT greatest(1, least(_limit, 50));
$$;

REVOKE ALL ON FUNCTION public.alixdocs_fts_search(text, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.alixdocs_fts_search(text, int) TO authenticated, service_role;
