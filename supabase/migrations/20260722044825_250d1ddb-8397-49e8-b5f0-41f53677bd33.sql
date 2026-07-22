
-- FTS RPC for alixdocs2
CREATE OR REPLACE FUNCTION public.alixdocs2_fts_search(_query text, _limit int DEFAULT 20)
RETURNS TABLE(id uuid, title text, doc_type text, snippet text, rank real)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT d.id, d.title, d.doc_type,
    ts_headline('simple', coalesce(d.ocr_text, d.title, ''), plainto_tsquery('simple', _query),
      'MaxWords=25,MinWords=10,ShortWord=2,MaxFragments=2') AS snippet,
    ts_rank(d.search_tsv, plainto_tsquery('simple', _query)) AS rank
  FROM public.alixdocs2_documents d
  WHERE d.deleted_at IS NULL
    AND (
      d.search_tsv @@ plainto_tsquery('simple', _query)
      OR d.title ILIKE '%' || _query || '%'
      OR d.ocr_text ILIKE '%' || _query || '%'
    )
  ORDER BY rank DESC NULLS LAST, d.created_at DESC
  LIMIT _limit;
$$;
GRANT EXECUTE ON FUNCTION public.alixdocs2_fts_search(text, int) TO authenticated;
