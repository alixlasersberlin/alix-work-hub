
-- 1) Backfill tenant_id for AlixDocs documents
UPDATE public.alixdocs_documents d
SET tenant_id = public.tenant_id_for_source(o.source_system)
FROM public.orders o
WHERE d.tenant_id IS NULL AND d.order_id = o.id AND o.source_system IS NOT NULL;

UPDATE public.alixdocs_documents d
SET tenant_id = public.tenant_id_for_source(c.source_system)
FROM public.customers c
WHERE d.tenant_id IS NULL AND d.customer_id = c.id AND c.source_system IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_alixdocs_documents_tenant ON public.alixdocs_documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_alixdocs2_documents_tenant ON public.alixdocs2_documents(tenant_id);

-- 2) Auto-assign tenant on insert
DROP TRIGGER IF EXISTS trg_alixdocs_documents_tenant ON public.alixdocs_documents;
CREATE TRIGGER trg_alixdocs_documents_tenant
BEFORE INSERT ON public.alixdocs_documents
FOR EACH ROW EXECUTE FUNCTION public.set_tenant_from_relation();

-- 3) Helper: tenant check via parent document
CREATE OR REPLACE FUNCTION public.alixdocs_doc_tenant_ok(_doc_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT _doc_id IS NULL
      OR (NOT public.tenant_scope_restricted())
      OR public.tenant_scope_id_ok((SELECT d.tenant_id FROM public.alixdocs_documents d WHERE d.id = _doc_id));
$$;

CREATE OR REPLACE FUNCTION public.alixdocs2_doc_tenant_ok(_doc_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT _doc_id IS NULL
      OR (NOT public.tenant_scope_restricted())
      OR public.tenant_scope_id_ok((SELECT d.tenant_id FROM public.alixdocs2_documents d WHERE d.id = _doc_id));
$$;

-- 4) Restrictive tenant policies on child tables (AlixDocs v1)
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'alixdocs_versions','alixdocs_audit_log','alixdocs_ai_jobs',
    'alixdocs_approval_states','alixdocs_match_feedback',
    'alixdocs_portal_shares','alixdocs_share_events','alixdocs_document_links'
  ] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema='public' AND table_name=t AND column_name='document_id') THEN
      EXECUTE format('DROP POLICY IF EXISTS tenant_data_scope_all ON public.%I', t);
      EXECUTE format(
        'CREATE POLICY tenant_data_scope_all ON public.%I AS RESTRICTIVE FOR ALL TO authenticated
           USING (public.alixdocs_doc_tenant_ok(document_id))
           WITH CHECK (public.alixdocs_doc_tenant_ok(document_id))', t);
    END IF;
  END LOOP;

  FOREACH t IN ARRAY ARRAY[
    'alixdocs2_versions','alixdocs2_comments','alixdocs2_audit','alixdocs2_activity',
    'alixdocs2_relations','alixdocs2_tasks','alixdocs2_favorites','alixdocs2_embeddings'
  ] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema='public' AND table_name=t AND column_name='document_id') THEN
      EXECUTE format('DROP POLICY IF EXISTS tenant_data_scope_all ON public.%I', t);
      EXECUTE format(
        'CREATE POLICY tenant_data_scope_all ON public.%I AS RESTRICTIVE FOR ALL TO authenticated
           USING (public.alixdocs2_doc_tenant_ok(document_id))
           WITH CHECK (public.alixdocs2_doc_tenant_ok(document_id))', t);
    END IF;
  END LOOP;
END $$;
