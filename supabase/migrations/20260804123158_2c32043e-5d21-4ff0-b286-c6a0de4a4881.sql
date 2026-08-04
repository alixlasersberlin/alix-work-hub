DROP POLICY IF EXISTS journal_insert ON public.finance_journal;
CREATE POLICY journal_insert ON public.finance_journal
FOR INSERT TO authenticated
WITH CHECK (can_access_finance_module() AND (tenant_id IS NULL OR has_tenant_access(tenant_id)));

DROP POLICY IF EXISTS journal_select ON public.finance_journal;
CREATE POLICY journal_select ON public.finance_journal
FOR SELECT TO authenticated
USING (can_view_finance_module() AND (tenant_id IS NULL OR has_tenant_access(tenant_id)));

DROP POLICY IF EXISTS journal_update ON public.finance_journal;
CREATE POLICY journal_update ON public.finance_journal
FOR UPDATE TO authenticated
USING (can_access_finance_module() AND (tenant_id IS NULL OR has_tenant_access(tenant_id)))
WITH CHECK (can_access_finance_module() AND (tenant_id IS NULL OR has_tenant_access(tenant_id)));