DROP POLICY IF EXISTS "finance can read recurring profiles" ON public.zoho_recurring_profiles;
CREATE POLICY "finance can read recurring profiles"
ON public.zoho_recurring_profiles FOR SELECT TO authenticated
USING (
  can_access_finance()
  AND (
    has_role('Super Admin'::text)
    OR has_role('Admin'::text)
    OR tenant_id IS NULL
    OR has_tenant_access(tenant_id)
  )
);

DROP POLICY IF EXISTS "finance can read recurring invoices" ON public.zoho_recurring_invoices;
CREATE POLICY "finance can read recurring invoices"
ON public.zoho_recurring_invoices FOR SELECT TO authenticated
USING (
  can_access_finance()
  AND (
    has_role('Super Admin'::text)
    OR has_role('Admin'::text)
    OR tenant_id IS NULL
    OR has_tenant_access(tenant_id)
  )
);