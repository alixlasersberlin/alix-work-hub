
-- ============================================================
-- 1) Catalog media storage: scope read to catalog/sales roles
-- ============================================================
CREATE OR REPLACE FUNCTION public.catalog_can_read()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    has_role('Super Admin')
    OR has_role('Admin')
    OR has_role('Katalog')
    OR has_role('Katalog Preise')
    OR has_role('Order')
    OR has_role('Auftragsverwaltung')
    OR has_role('After Sales')
    OR has_role('SACHBEARBEITUNG')
    OR has_role('Österreich')
    OR has_role('Mediapaket')
    OR has_role('Finanzierungen')
    OR has_role('Read Only Audit')
$$;

REVOKE EXECUTE ON FUNCTION public.catalog_can_read() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.catalog_can_read() TO authenticated;

DROP POLICY IF EXISTS "catalog_media_read" ON storage.objects;
CREATE POLICY "catalog_media_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'catalog-media' AND public.catalog_can_read());

-- ============================================================
-- 2) Remove tenant_id IS NULL bypass on finance/zoho tables
-- ============================================================

-- finance_deposits
DROP POLICY IF EXISTS "finance_deposits_select" ON public.finance_deposits;
CREATE POLICY "finance_deposits_select" ON public.finance_deposits
  FOR SELECT TO authenticated
  USING (
    can_view_finance_module()
    AND (
      is_admin()
      OR (tenant_id IS NOT NULL AND has_tenant_access(tenant_id))
    )
  );

-- finance_records
DROP POLICY IF EXISTS "authorized roles can read finance records" ON public.finance_records;
CREATE POLICY "authorized roles can read finance records" ON public.finance_records
  FOR SELECT TO authenticated
  USING (
    can_access_finance()
    AND (
      has_role('Super Admin')
      OR (tenant_id IS NOT NULL AND has_tenant_access(tenant_id))
    )
  );

DROP POLICY IF EXISTS "authorized roles can update finance records" ON public.finance_records;
CREATE POLICY "authorized roles can update finance records" ON public.finance_records
  FOR UPDATE TO authenticated
  USING (
    can_access_finance()
    AND (
      has_role('Super Admin')
      OR (tenant_id IS NOT NULL AND has_tenant_access(tenant_id))
    )
  )
  WITH CHECK (
    can_access_finance()
    AND (
      has_role('Super Admin')
      OR (tenant_id IS NOT NULL AND has_tenant_access(tenant_id))
    )
  );

-- zoho_invoices
DROP POLICY IF EXISTS "finance can read zoho invoices" ON public.zoho_invoices;
CREATE POLICY "finance can read zoho invoices" ON public.zoho_invoices
  FOR SELECT TO authenticated
  USING (
    can_access_finance()
    AND (
      is_admin()
      OR (tenant_id IS NOT NULL AND has_tenant_access(tenant_id))
    )
  );
