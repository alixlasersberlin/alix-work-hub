
DROP POLICY IF EXISTS "esc_signatures internal read" ON public.esc_signatures;
DROP POLICY IF EXISTS "esc_signatures scoped read" ON public.esc_signatures;
CREATE POLICY "esc_signatures scoped read"
ON public.esc_signatures
FOR SELECT
TO authenticated
USING (
  is_internal_user() AND (
    is_admin()
    OR created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.esc_events e
      WHERE e.id = esc_signatures.event_id
        AND (
          e.assigned_user_id = auth.uid()
          OR e.created_by = auth.uid()
          OR (e.department_id IS NOT NULL AND e.department_id IN (SELECT public.esc_user_department_ids(auth.uid())))
        )
    )
  )
);

DROP POLICY IF EXISTS "factory invoice can read production-photos objects" ON storage.objects;
CREATE POLICY "factory invoice can read production-photos objects"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'production-photos'
  AND public.has_role('FACTORY INVOICE')
  AND EXISTS (
    SELECT 1 FROM public.production_orders po
    WHERE po.supplier_id::text = (storage.foldername(name))[1]
      AND (po.invoice_pdf_path IS NULL OR length(trim(po.invoice_pdf_path)) = 0)
  )
);

DROP POLICY IF EXISTS ic_rel_select ON public.finance_intercompany_relations;
CREATE POLICY ic_rel_select ON public.finance_intercompany_relations
FOR SELECT TO authenticated
USING (
  has_role('Super Admin') OR has_role('Geschäftsführung')
  OR (can_access_finance() AND public.has_tenant_access(source_tenant_id) AND public.has_tenant_access(target_tenant_id))
);

DROP POLICY IF EXISTS ic_match_select ON public.finance_intercompany_matches;
CREATE POLICY ic_match_select ON public.finance_intercompany_matches
FOR SELECT TO authenticated
USING (
  has_role('Super Admin') OR has_role('Geschäftsführung')
  OR (can_access_finance() AND public.has_tenant_access(source_tenant_id) AND public.has_tenant_access(target_tenant_id))
);

DROP POLICY IF EXISTS fx_select ON public.finance_fx_rates;
CREATE POLICY fx_select ON public.finance_fx_rates
FOR SELECT TO authenticated
USING (has_role('Super Admin') OR has_role('Geschäftsführung'));

DROP POLICY IF EXISTS cons_run_select ON public.finance_consolidation_runs;
CREATE POLICY cons_run_select ON public.finance_consolidation_runs
FOR SELECT TO authenticated
USING (has_role('Super Admin') OR has_role('Geschäftsführung'));

DROP POLICY IF EXISTS cons_items_select ON public.finance_consolidation_items;
CREATE POLICY cons_items_select ON public.finance_consolidation_items
FOR SELECT TO authenticated
USING (
  has_role('Super Admin') OR has_role('Geschäftsführung')
  OR (can_access_finance() AND public.has_tenant_access(tenant_id))
);
