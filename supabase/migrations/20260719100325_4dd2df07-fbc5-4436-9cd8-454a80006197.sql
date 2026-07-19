
DROP POLICY IF EXISTS docs_read ON public.alixdocs_documents;
CREATE POLICY docs_read ON public.alixdocs_documents
FOR SELECT TO authenticated
USING (
  public.is_internal_user()
  AND deleted_at IS NULL
  AND confidentiality_level <> 'streng_vertraulich'
);

DROP POLICY IF EXISTS ver_read ON public.alixdocs_versions;
CREATE POLICY ver_read ON public.alixdocs_versions
FOR SELECT TO authenticated
USING (
  public.is_internal_user()
  AND EXISTS (
    SELECT 1 FROM public.alixdocs_documents d
    WHERE d.id = alixdocs_versions.document_id
      AND d.deleted_at IS NULL
  )
);

DROP POLICY IF EXISTS "chains authenticated read" ON public.alixdocs_approval_chains;
CREATE POLICY "chains internal read" ON public.alixdocs_approval_chains
FOR SELECT TO authenticated
USING (active = true AND public.is_internal_user());
