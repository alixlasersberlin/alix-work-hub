
-- Restrict catalog_portal_checkouts SELECT to staff + owning portal user
DROP POLICY IF EXISTS checkout_read_auth ON public.catalog_portal_checkouts;
CREATE POLICY checkout_read_staff_or_owner ON public.catalog_portal_checkouts
FOR SELECT TO authenticated
USING (
  has_role('Super Admin') OR has_role('Admin') OR has_role('Katalog') OR has_role('Order')
  OR has_role('Vertrieb') OR has_role('Vertriebsleitung') OR has_role('Service')
  OR EXISTS (
    SELECT 1 FROM public.customer_portal_users u
    WHERE u.id = catalog_portal_checkouts.portal_user_id AND u.user_id = auth.uid()
  )
);

-- Restrict customer price group assignments to internal staff
DROP POLICY IF EXISTS cpg_read_auth ON public.catalog_customer_price_group;
CREATE POLICY cpg_read_staff ON public.catalog_customer_price_group
FOR SELECT TO authenticated
USING (
  has_role('Super Admin') OR has_role('Admin') OR has_role('Katalog') OR has_role('Katalog Preise')
  OR has_role('Vertrieb') OR has_role('Vertriebsleitung') OR has_role('Finanzen') OR has_role('Order')
);

-- Restrict price group overrides to internal staff
DROP POLICY IF EXISTS pgo_read_auth ON public.catalog_price_group_overrides;
CREATE POLICY pgo_read_staff ON public.catalog_price_group_overrides
FOR SELECT TO authenticated
USING (
  has_role('Super Admin') OR has_role('Admin') OR has_role('Katalog') OR has_role('Katalog Preise')
  OR has_role('Vertrieb') OR has_role('Vertriebsleitung') OR has_role('Finanzen') OR has_role('Order')
);

-- Restrict catalog_item_snapshots reads to staff (they're linked to internal offers/orders/inquiries)
DROP POLICY IF EXISTS cat_snap_read ON public.catalog_item_snapshots;
CREATE POLICY cat_snap_read_staff ON public.catalog_item_snapshots
FOR SELECT TO authenticated
USING (
  has_role('Super Admin') OR has_role('Admin') OR has_role('Katalog') OR has_role('Katalog Preise')
  OR has_role('Vertrieb') OR has_role('Vertriebsleitung') OR has_role('Service') OR has_role('Order')
  OR has_role('Finanzen')
  OR created_by = auth.uid()
);
