
-- 1) Katalog-Preise & Artikel: SELECT auf preisrelevante Rollen beschränken
DROP POLICY IF EXISTS "cat_prices_read" ON public.catalog_item_prices;
CREATE POLICY "cat_prices_read" ON public.catalog_item_prices
FOR SELECT TO authenticated
USING (
  has_role('Super Admin') OR has_role('Admin')
  OR has_role('Katalog') OR has_role('Katalog Preise')
  OR has_role('Vertrieb') OR has_role('Vertriebsleitung')
  OR has_role('Marketing') OR has_role('Geschäftsführung')
  OR can_access_finance()
);

DROP POLICY IF EXISTS "cat_items_read" ON public.catalog_items;
CREATE POLICY "cat_items_read" ON public.catalog_items
FOR SELECT TO authenticated
USING (
  has_role('Super Admin') OR has_role('Admin')
  OR has_role('Katalog') OR has_role('Katalog Preise')
  OR has_role('Vertrieb') OR has_role('Vertriebsleitung')
  OR has_role('Marketing') OR has_role('Service')
  OR has_role('Geschäftsführung') OR has_role('Order')
  OR has_role('Lager') OR has_role('Technik')
  OR has_role('Tourenplanung') OR has_role('Reparaturannahme')
  OR has_role('Österreich') OR has_role('QM')
  OR can_access_finance()
);

-- 2) finance_records: Tenant-Isolation auch bei INSERT/UPDATE erzwingen
DROP POLICY IF EXISTS "authorized roles can insert finance records" ON public.finance_records;
CREATE POLICY "authorized roles can insert finance records" ON public.finance_records
FOR INSERT TO authenticated
WITH CHECK (
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

-- 3) role_change_requests: target_user_id einschränken – Selbst-Request
--    oder Admin/Super Admin dürfen andere Nutzer nominieren.
DROP POLICY IF EXISTS "Users can request roles with configured approval chain" ON public.role_change_requests;
CREATE POLICY "Users can request roles with configured approval chain"
ON public.role_change_requests
FOR INSERT TO authenticated
WITH CHECK (
  has_role('Super Admin')
  OR (
    requested_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM role_approval_chains rac
      WHERE rac.role_id = role_change_requests.role_id
    )
    AND (
      target_user_id = auth.uid()          -- Selbst-Antrag
      OR has_role('Admin')                 -- Admins dürfen für Andere beantragen
    )
  )
);
