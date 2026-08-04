-- Hilfsfunktion: erlaubte Buchhaltungsregionen eines Nutzers (einmalige Auswertung)
CREATE OR REPLACE FUNCTION public.user_accounting_regions()
RETURNS accounting_region[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(DISTINCT reg), ARRAY[]::accounting_region[])
  FROM (
    SELECT unnest(
      CASE
        WHEN r.name IN ('Super Admin','Admin','Buchhaltung Admin') THEN ARRAY['EU','CH']::accounting_region[]
        WHEN r.name IN ('Buchhaltung EU','Finance') THEN ARRAY['EU']::accounting_region[]
        WHEN r.name = 'Buchhaltung CH' THEN ARRAY['CH']::accounting_region[]
        ELSE ARRAY[]::accounting_region[]
      END
    ) AS reg
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
  ) s;
$$;

REVOKE ALL ON FUNCTION public.user_accounting_regions() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.user_accounting_regions() TO authenticated;

-- zoho_recurring_profiles
DROP POLICY IF EXISTS "region_scope_select" ON public.zoho_recurring_profiles;
CREATE POLICY "region_scope_select" ON public.zoho_recurring_profiles
FOR ALL
USING (accounting_region = ANY (SELECT unnest(public.user_accounting_regions())))
WITH CHECK (accounting_region = ANY (SELECT unnest(public.user_accounting_regions())));

DROP POLICY IF EXISTS "finance can read recurring profiles" ON public.zoho_recurring_profiles;
CREATE POLICY "finance can read recurring profiles" ON public.zoho_recurring_profiles
FOR SELECT
USING (
  (SELECT public.can_access_finance())
  AND (
    (SELECT public.has_role('Super Admin')) OR (SELECT public.has_role('Admin'))
    OR tenant_id IS NULL OR public.has_tenant_access(tenant_id)
  )
);

-- lager_devices
DROP POLICY IF EXISTS "admins read lager devices" ON public.lager_devices;
CREATE POLICY "admins read lager devices" ON public.lager_devices
FOR SELECT USING ((SELECT public.is_admin()));

DROP POLICY IF EXISTS "order role read lager devices" ON public.lager_devices;
CREATE POLICY "order role read lager devices" ON public.lager_devices
FOR SELECT USING ((SELECT public.has_role('Order')));

DROP POLICY IF EXISTS "sachbearbeitung read lager devices" ON public.lager_devices;
CREATE POLICY "sachbearbeitung read lager devices" ON public.lager_devices
FOR SELECT USING ((SELECT public.has_role('SACHBEARBEITUNG')));

DROP POLICY IF EXISTS "planning roles read reserved lager devices" ON public.lager_devices;
CREATE POLICY "planning roles read reserved lager devices" ON public.lager_devices
FOR SELECT USING (
  reserved_order_id IS NOT NULL
  AND ((SELECT public.can_access_planning()) OR (SELECT public.can_access_orders()))
);

DROP POLICY IF EXISTS "at role can read at reserved lager devices" ON public.lager_devices;
CREATE POLICY "at role can read at reserved lager devices" ON public.lager_devices
FOR SELECT USING (
  (SELECT public.has_role('Österreich'))
  AND reserved_order_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.orders o WHERE o.id = lager_devices.reserved_order_id AND o.source_system = 'zoho_eu_2')
);

-- production_orders
DROP POLICY IF EXISTS "admins read production orders" ON public.production_orders;
CREATE POLICY "admins read production orders" ON public.production_orders
FOR SELECT USING ((SELECT public.is_admin()));

DROP POLICY IF EXISTS "order role read production orders" ON public.production_orders;
CREATE POLICY "order role read production orders" ON public.production_orders
FOR SELECT USING ((SELECT public.has_role('Order')));

DROP POLICY IF EXISTS "sachbearbeitung read production orders" ON public.production_orders;
CREATE POLICY "sachbearbeitung read production orders" ON public.production_orders
FOR SELECT USING ((SELECT public.has_role('SACHBEARBEITUNG')));

DROP POLICY IF EXISTS "factory invoice can read production orders" ON public.production_orders;
CREATE POLICY "factory invoice can read production orders" ON public.production_orders
FOR SELECT USING ((SELECT public.can_upload_factory_invoice()));

DROP POLICY IF EXISTS "at role can read at production orders" ON public.production_orders;
CREATE POLICY "at role can read at production orders" ON public.production_orders
FOR SELECT USING (
  (SELECT public.has_role('Österreich'))
  AND EXISTS (SELECT 1 FROM public.orders o WHERE o.id = production_orders.order_id AND o.source_system = 'zoho_eu_2')
);

DROP POLICY IF EXISTS "suppliers can read own production orders" ON public.production_orders;
CREATE POLICY "suppliers can read own production orders" ON public.production_orders
FOR SELECT USING (
  (SELECT public.is_supplier())
  AND supplier_id = (SELECT public.current_supplier_id())
  AND approval_status = 'approved'
);

-- offers
DROP POLICY IF EXISTS "Offers visible to sales-relevant roles" ON public.offers;
CREATE POLICY "Offers visible to sales-relevant roles" ON public.offers
FOR SELECT USING (
  (SELECT public.is_admin())
  OR (SELECT public.has_role('Vertriebsleitung'))
  OR (SELECT public.has_role('Vertrieb'))
  OR (SELECT public.has_role('Order'))
  OR (SELECT public.has_role('Auftragsverwaltung'))
  OR (SELECT public.has_role('Finance'))
  OR (SELECT public.has_role('SACHBEARBEITUNG'))
  OR (SELECT public.has_role('Geschäftsführung'))
  OR created_by = (SELECT auth.uid())
);

-- sales_leads
DROP POLICY IF EXISTS "sales_leads_select" ON public.sales_leads;
CREATE POLICY "sales_leads_select" ON public.sales_leads
FOR SELECT USING (
  (SELECT public.is_admin())
  OR (SELECT public.has_role('Vertrieb'))
  OR (SELECT public.has_role('Vertriebsleitung'))
  OR (SELECT public.has_role('Order'))
  OR (SELECT public.has_role('SACHBEARBEITUNG'))
);

-- route_plans
DROP POLICY IF EXISTS "authorized roles can read route plans" ON public.route_plans;
CREATE POLICY "authorized roles can read route plans" ON public.route_plans
FOR SELECT USING (
  (SELECT public.can_access_planning()) OR (SELECT public.can_access_finance())
);