
DROP POLICY IF EXISTS "finance can read zoho invoices" ON public.zoho_invoices;
CREATE POLICY "finance can read zoho invoices" ON public.zoho_invoices
FOR SELECT USING (
  can_access_finance() AND (
    has_role('Super Admin') OR tenant_id IS NULL OR has_tenant_access(tenant_id)
  )
);

DROP POLICY IF EXISTS "finance can read zoho unpaid invoices" ON public.zoho_unpaid_invoices;
CREATE POLICY "finance can read zoho unpaid invoices" ON public.zoho_unpaid_invoices
FOR SELECT USING (
  can_access_finance() AND (
    has_role('Super Admin') OR tenant_id IS NULL OR has_tenant_access(tenant_id)
  )
);

DROP POLICY IF EXISTS "finance can read recurring invoices" ON public.zoho_recurring_invoices;
CREATE POLICY "finance can read recurring invoices" ON public.zoho_recurring_invoices
FOR SELECT USING (
  can_access_finance() AND (
    has_role('Super Admin') OR tenant_id IS NULL OR has_tenant_access(tenant_id)
  )
);

DROP POLICY IF EXISTS "finance can read recurring profiles" ON public.zoho_recurring_profiles;
CREATE POLICY "finance can read recurring profiles" ON public.zoho_recurring_profiles
FOR SELECT USING (
  can_access_finance() AND (
    has_role('Super Admin') OR tenant_id IS NULL OR has_tenant_access(tenant_id)
  )
);
