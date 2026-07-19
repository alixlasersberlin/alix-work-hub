
CREATE TABLE IF NOT EXISTS public.alixdocs_document_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_doc_id uuid NOT NULL REFERENCES public.alixdocs_documents(id) ON DELETE CASCADE,
  to_doc_id uuid NOT NULL REFERENCES public.alixdocs_documents(id) ON DELETE CASCADE,
  link_type text NOT NULL DEFAULT 'references',
  confidence integer NOT NULL DEFAULT 100,
  source text NOT NULL DEFAULT 'manual',
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT alixdocs_links_no_self CHECK (from_doc_id <> to_doc_id),
  CONSTRAINT alixdocs_links_uniq UNIQUE (from_doc_id, to_doc_id, link_type)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.alixdocs_document_links TO authenticated;
GRANT ALL ON public.alixdocs_document_links TO service_role;
ALTER TABLE public.alixdocs_document_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "alixdocs_links_admin_all"
ON public.alixdocs_document_links FOR ALL TO authenticated
USING (public.has_role('Admin') OR public.has_role('Super Admin'))
WITH CHECK (public.has_role('Admin') OR public.has_role('Super Admin'));

CREATE POLICY "alixdocs_links_read_authenticated"
ON public.alixdocs_document_links FOR SELECT TO authenticated
USING (true);

CREATE INDEX IF NOT EXISTS idx_alixdocs_links_from ON public.alixdocs_document_links(from_doc_id);
CREATE INDEX IF NOT EXISTS idx_alixdocs_links_to ON public.alixdocs_document_links(to_doc_id);

ALTER TABLE public.alixdocs_documents
  ADD COLUMN IF NOT EXISTS dedupe_ignored boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_alixdocs_content_hash
  ON public.alixdocs_documents(content_hash)
  WHERE content_hash IS NOT NULL AND deleted_at IS NULL;
