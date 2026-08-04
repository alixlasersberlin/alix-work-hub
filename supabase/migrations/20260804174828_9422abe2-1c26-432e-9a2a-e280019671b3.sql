-- CUSTOMERS: consolidate SELECT policies into one InitPlan-optimized policy
DROP POLICY IF EXISTS "Users see own created customers" ON public.customers;
DROP POLICY IF EXISTS "Users see own customers" ON public.customers;
DROP POLICY IF EXISTS "at role can read at customers" ON public.customers;
DROP POLICY IF EXISTS "authorized roles can read customers" ON public.customers;
DROP POLICY IF EXISTS "financing role can read financing customers" ON public.customers;
DROP POLICY IF EXISTS "portal_customer_select_own" ON public.customers;
DROP POLICY IF EXISTS "repair role can read linked repair customers" ON public.customers;

CREATE POLICY "customers_select_consolidated" ON public.customers
FOR SELECT
USING (
  (SELECT can_access_orders())
  OR created_by = (SELECT auth.uid())
  OR user_id = (SELECT auth.uid())
  OR ((SELECT has_role('Österreich'::text)) AND source_system = 'zoho_eu_2'::text)
  OR ((SELECT has_role('Finanzierungen'::text)) AND EXISTS (
        SELECT 1 FROM bank_financing_requests bfr
        JOIN orders o ON o.id = bfr.order_id
        WHERE o.customer_id = customers.id))
  OR id = (SELECT current_portal_customer_id())
  OR ((SELECT can_access_repair()) AND EXISTS (
        SELECT 1 FROM repair_orders ro WHERE ro.customer_id = customers.id))
);

-- ORDERS
DROP POLICY IF EXISTS "at role can read at orders" ON public.orders;
DROP POLICY IF EXISTS "authorized roles can read orders" ON public.orders;
DROP POLICY IF EXISTS "financing role can read financing orders" ON public.orders;
DROP POLICY IF EXISTS "portal_customer_select_own_orders" ON public.orders;
DROP POLICY IF EXISTS "repair role can read orders" ON public.orders;

CREATE POLICY "orders_select_consolidated" ON public.orders
FOR SELECT
USING (
  (SELECT can_access_orders())
  OR (SELECT can_access_repair())
  OR ((SELECT has_role('Österreich'::text)) AND source_system = 'zoho_eu_2'::text)
  OR ((SELECT has_role('Finanzierungen'::text)) AND EXISTS (
        SELECT 1 FROM bank_financing_requests bfr WHERE bfr.order_id = orders.id))
  OR customer_id = (SELECT current_portal_customer_id())
);

-- ORDER ITEMS
DROP POLICY IF EXISTS "at role can read at order items" ON public.order_items;
DROP POLICY IF EXISTS "authorized roles can read order items" ON public.order_items;
DROP POLICY IF EXISTS "financing role can read financing order items" ON public.order_items;

CREATE POLICY "order_items_select_consolidated" ON public.order_items
FOR SELECT
USING (
  (SELECT can_access_orders())
  OR ((SELECT has_role('Österreich'::text)) AND EXISTS (
        SELECT 1 FROM orders o
        WHERE o.id = order_items.order_id AND o.source_system = 'zoho_eu_2'::text))
  OR ((SELECT has_role('Finanzierungen'::text)) AND EXISTS (
        SELECT 1 FROM bank_financing_requests bfr WHERE bfr.order_id = order_items.order_id))
);

-- EMAIL SEND LOG
DROP POLICY IF EXISTS "email_send_log read admin/marketing" ON public.email_send_log;
CREATE POLICY "email_send_log read admin/marketing" ON public.email_send_log
FOR SELECT
USING ((SELECT is_admin()) OR (SELECT has_role('Marketing'::text)));

-- Supporting indexes for the EXISTS sub-checks used by the policies
CREATE INDEX IF NOT EXISTS idx_bank_financing_requests_order_id ON public.bank_financing_requests (order_id);
CREATE INDEX IF NOT EXISTS idx_repair_orders_customer_id ON public.repair_orders (customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_date_desc ON public.orders (order_date DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_orders_expected_shipment_date ON public.orders (expected_shipment_date) WHERE expected_shipment_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_zoho_items_status_name ON public.zoho_items (status, name);
CREATE INDEX IF NOT EXISTS idx_offers_status ON public.offers (status);
