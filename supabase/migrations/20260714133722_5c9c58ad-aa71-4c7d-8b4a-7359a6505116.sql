
-- Expand finance module view access to Finanzierungen/Order roles
CREATE OR REPLACE FUNCTION public.can_view_finance_module()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.is_admin()
      OR public.has_role('Finance')
      OR public.has_role('Geschäftsführung')
      OR public.has_role('Finanzierungen')
      OR public.has_role('Order');
$$;

-- finance_deposits: allow legacy rows without tenant_id
DROP POLICY IF EXISTS finance_deposits_select ON public.finance_deposits;
CREATE POLICY finance_deposits_select ON public.finance_deposits
FOR SELECT TO authenticated
USING (
  public.can_view_finance_module()
  AND (
    public.is_admin()
    OR tenant_id IS NULL
    OR public.has_tenant_access(tenant_id)
  )
);

-- zoho_invoices: same relaxation
DROP POLICY IF EXISTS "finance can read zoho invoices" ON public.zoho_invoices;
CREATE POLICY "finance can read zoho invoices" ON public.zoho_invoices
FOR SELECT TO authenticated
USING (
  public.can_access_finance()
  AND (
    public.is_admin()
    OR tenant_id IS NULL
    OR public.has_tenant_access(tenant_id)
  )
);
