
ALTER TABLE public.alixdocs2_documents ADD COLUMN IF NOT EXISTS editor_html text;

CREATE OR REPLACE FUNCTION public.alixdocs2_match_embeddings(
  query_embedding vector(1536),
  match_count int DEFAULT 10
)
RETURNS TABLE (
  doc_id uuid,
  chunk_index int,
  content text,
  similarity float
)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT e.doc_id, e.chunk_index, e.content,
         1 - (e.embedding <=> query_embedding) AS similarity
  FROM public.alixdocs2_embeddings e
  ORDER BY e.embedding <=> query_embedding
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION public.alixdocs2_match_embeddings(vector, int) TO authenticated, service_role;
