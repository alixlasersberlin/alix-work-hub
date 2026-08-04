
-- production_orders: consolidate SELECT policies
DROP POLICY IF EXISTS "admins read production orders" ON public.production_orders;
DROP POLICY IF EXISTS "at role can read at production orders" ON public.production_orders;
DROP POLICY IF EXISTS "factory invoice can read production orders" ON public.production_orders;
DROP POLICY IF EXISTS "order role read production orders" ON public.production_orders;
DROP POLICY IF EXISTS "portal_customer_select_own_production" ON public.production_orders;
DROP POLICY IF EXISTS "sachbearbeitung read production orders" ON public.production_orders;
DROP POLICY IF EXISTS "suppliers can read own production orders" ON public.production_orders;

CREATE POLICY "production_orders_read_consolidated"
ON public.production_orders FOR SELECT
USING (
  (SELECT is_admin())
  OR (SELECT has_role('Order'::text))
  OR (SELECT has_role('SACHBEARBEITUNG'::text))
  OR (SELECT can_upload_factory_invoice())
  OR (
    (SELECT is_supplier())
    AND supplier_id = (SELECT current_supplier_id())
    AND approval_status = 'approved'
  )
  OR (
    (SELECT has_role('Österreich'::text))
    AND EXISTS (SELECT 1 FROM public.orders o WHERE o.id = production_orders.order_id AND o.source_system = 'zoho_eu_2')
  )
  OR (
    (SELECT current_portal_customer_id()) IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.orders o WHERE o.id = production_orders.order_id AND o.customer_id = (SELECT current_portal_customer_id()))
  )
);

-- lager_devices: consolidate SELECT policies
DROP POLICY IF EXISTS "admins read lager devices" ON public.lager_devices;
DROP POLICY IF EXISTS "at role can read at reserved lager devices" ON public.lager_devices;
DROP POLICY IF EXISTS "order role read lager devices" ON public.lager_devices;
DROP POLICY IF EXISTS "planning roles read reserved lager devices" ON public.lager_devices;
DROP POLICY IF EXISTS "portal_customer_select_own_devices" ON public.lager_devices;
DROP POLICY IF EXISTS "sachbearbeitung read lager devices" ON public.lager_devices;

CREATE POLICY "lager_devices_read_consolidated"
ON public.lager_devices FOR SELECT
USING (
  (SELECT is_admin())
  OR (SELECT has_role('Order'::text))
  OR (SELECT has_role('SACHBEARBEITUNG'::text))
  OR (reserved_order_id IS NOT NULL AND ((SELECT can_access_planning()) OR (SELECT can_access_orders())))
  OR (
    (SELECT has_role('Österreich'::text))
    AND reserved_order_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.orders o WHERE o.id = lager_devices.reserved_order_id AND o.source_system = 'zoho_eu_2')
  )
  OR (
    (SELECT current_portal_customer_id()) IS NOT NULL
    AND (
      reserved_order_id IN (SELECT id FROM public.orders WHERE customer_id = (SELECT current_portal_customer_id()))
      OR delivered_order_id IN (SELECT id FROM public.orders WHERE customer_id = (SELECT current_portal_customer_id()))
    )
  )
);

-- supporting indexes
CREATE INDEX IF NOT EXISTS idx_production_orders_order_id ON public.production_orders(order_id);
CREATE INDEX IF NOT EXISTS idx_production_orders_approval_status ON public.production_orders(approval_status);
CREATE INDEX IF NOT EXISTS idx_production_orders_is_reclamation ON public.production_orders(is_reclamation);
CREATE INDEX IF NOT EXISTS idx_lager_devices_reserved_order_id ON public.lager_devices(reserved_order_id);
CREATE INDEX IF NOT EXISTS idx_lager_devices_delivered_order_id ON public.lager_devices(delivered_order_id);
