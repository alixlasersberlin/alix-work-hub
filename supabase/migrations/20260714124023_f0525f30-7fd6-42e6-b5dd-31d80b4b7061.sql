
CREATE OR REPLACE FUNCTION public.can_access_finance()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    public.is_admin()
    OR public.has_role('Finance')
    OR public.has_role('Finanzierungen')
    OR public.has_role('Order');
$$;

DROP POLICY IF EXISTS "authorized roles can insert finance records" ON public.finance_records;
DROP POLICY IF EXISTS "authorized roles can read finance records" ON public.finance_records;
DROP POLICY IF EXISTS "authorized roles can update finance records" ON public.finance_records;

CREATE POLICY "authorized roles can read finance records"
ON public.finance_records FOR SELECT TO authenticated
USING (
  public.can_access_finance()
  AND (
    public.has_role('Super Admin')
    OR tenant_id IS NULL
    OR public.has_tenant_access(tenant_id)
  )
);

CREATE POLICY "authorized roles can insert finance records"
ON public.finance_records FOR INSERT TO authenticated
WITH CHECK (
  public.can_access_finance()
  AND (
    public.has_role('Super Admin')
    OR tenant_id IS NULL
    OR public.has_tenant_access(tenant_id)
  )
);

CREATE POLICY "authorized roles can update finance records"
ON public.finance_records FOR UPDATE TO authenticated
USING (
  public.can_access_finance()
  AND (
    public.has_role('Super Admin')
    OR tenant_id IS NULL
    OR public.has_tenant_access(tenant_id)
  )
)
WITH CHECK (
  public.can_access_finance()
  AND (
    public.has_role('Super Admin')
    OR tenant_id IS NULL
    OR public.has_tenant_access(tenant_id)
  )
);
