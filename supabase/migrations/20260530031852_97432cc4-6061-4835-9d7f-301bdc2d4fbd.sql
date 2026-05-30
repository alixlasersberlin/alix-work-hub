-- Erweiterte AT-Lesepolicies für Rolle Österreich

-- ORDERS
DROP POLICY IF EXISTS "at role can read at orders" ON public.orders;
CREATE POLICY "at role can read at orders" ON public.orders
FOR SELECT TO authenticated
USING (has_role('Österreich') AND source_system = 'zoho_eu_2');

-- CUSTOMERS
DROP POLICY IF EXISTS "at role can read at customers" ON public.customers;
CREATE POLICY "at role can read at customers" ON public.customers
FOR SELECT TO authenticated
USING (has_role('Österreich') AND source_system = 'zoho_eu_2');

-- ORDER_ITEMS
DROP POLICY IF EXISTS "at role can read at order items" ON public.order_items;
CREATE POLICY "at role can read at order items" ON public.order_items
FOR SELECT TO authenticated
USING (has_role('Österreich') AND EXISTS (
  SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id AND o.source_system = 'zoho_eu_2'
));

-- ORDER_NOTES
DROP POLICY IF EXISTS "at role can read at order notes" ON public.order_notes;
CREATE POLICY "at role can read at order notes" ON public.order_notes
FOR SELECT TO authenticated
USING (has_role('Österreich') AND EXISTS (
  SELECT 1 FROM public.orders o WHERE o.id = order_notes.order_id AND o.source_system = 'zoho_eu_2'
));

-- ORDER_STATUS_HISTORY
DROP POLICY IF EXISTS "at role can read at order status history" ON public.order_status_history;
CREATE POLICY "at role can read at order status history" ON public.order_status_history
FOR SELECT TO authenticated
USING (has_role('Österreich') AND EXISTS (
  SELECT 1 FROM public.orders o WHERE o.id = order_status_history.order_id AND o.source_system = 'zoho_eu_2'
));

-- ORDER_DOCUMENTS
DROP POLICY IF EXISTS "at role can read at order documents" ON public.order_documents;
CREATE POLICY "at role can read at order documents" ON public.order_documents
FOR SELECT TO authenticated
USING (has_role('Österreich') AND EXISTS (
  SELECT 1 FROM public.orders o WHERE o.id = order_documents.order_id AND o.source_system = 'zoho_eu_2'
));

-- ORDER_ADDITIONAL_DEPOSITS
DROP POLICY IF EXISTS "at role can read at additional deposits" ON public.order_additional_deposits;
CREATE POLICY "at role can read at additional deposits" ON public.order_additional_deposits
FOR SELECT TO authenticated
USING (has_role('Österreich') AND EXISTS (
  SELECT 1 FROM public.orders o WHERE o.id = order_additional_deposits.order_id AND o.source_system = 'zoho_eu_2'
));

-- PRODUCTION_ORDERS
DROP POLICY IF EXISTS "at role can read at production orders" ON public.production_orders;
CREATE POLICY "at role can read at production orders" ON public.production_orders
FOR SELECT TO authenticated
USING (has_role('Österreich') AND EXISTS (
  SELECT 1 FROM public.orders o WHERE o.id = production_orders.order_id AND o.source_system = 'zoho_eu_2'
));

-- PRODUCTION_ORDER_ITEMS
DROP POLICY IF EXISTS "at role can read at production order items" ON public.production_order_items;
CREATE POLICY "at role can read at production order items" ON public.production_order_items
FOR SELECT TO authenticated
USING (has_role('Österreich') AND EXISTS (
  SELECT 1
  FROM public.production_orders po
  JOIN public.orders o ON o.id = po.order_id
  WHERE po.id = production_order_items.production_order_id
    AND o.source_system = 'zoho_eu_2'
));

-- LAGER_DEVICES (nur Geräte, die an einem AT-Auftrag reserviert sind)
DROP POLICY IF EXISTS "at role can read at reserved lager devices" ON public.lager_devices;
CREATE POLICY "at role can read at reserved lager devices" ON public.lager_devices
FOR SELECT TO authenticated
USING (has_role('Österreich') AND reserved_order_id IS NOT NULL AND EXISTS (
  SELECT 1 FROM public.orders o WHERE o.id = lager_devices.reserved_order_id AND o.source_system = 'zoho_eu_2'
));