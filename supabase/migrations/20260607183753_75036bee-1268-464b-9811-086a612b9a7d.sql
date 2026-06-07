
DROP POLICY IF EXISTS "at role can insert at additional deposits" ON public.order_additional_deposits;
DROP POLICY IF EXISTS "at role can read at additional deposits" ON public.order_additional_deposits;
DROP POLICY IF EXISTS "at role can update at additional deposits" ON public.order_additional_deposits;
DROP POLICY IF EXISTS "at role can update at orders" ON public.orders;

CREATE POLICY "at role can insert at additional deposits"
ON public.order_additional_deposits FOR INSERT TO authenticated
WITH CHECK (has_role('Österreich') AND EXISTS (SELECT 1 FROM orders o WHERE o.id = order_additional_deposits.order_id AND o.source_system = 'zoho_eu_2'));

CREATE POLICY "at role can read at additional deposits"
ON public.order_additional_deposits FOR SELECT TO authenticated
USING (has_role('Österreich') AND EXISTS (SELECT 1 FROM orders o WHERE o.id = order_additional_deposits.order_id AND o.source_system = 'zoho_eu_2'));

CREATE POLICY "at role can update at additional deposits"
ON public.order_additional_deposits FOR UPDATE TO authenticated
USING (has_role('Österreich') AND EXISTS (SELECT 1 FROM orders o WHERE o.id = order_additional_deposits.order_id AND o.source_system = 'zoho_eu_2'))
WITH CHECK (has_role('Österreich') AND EXISTS (SELECT 1 FROM orders o WHERE o.id = order_additional_deposits.order_id AND o.source_system = 'zoho_eu_2'));

CREATE POLICY "at role can update at orders"
ON public.orders FOR UPDATE TO authenticated
USING (has_role('Österreich') AND source_system = 'zoho_eu_2')
WITH CHECK (has_role('Österreich') AND source_system = 'zoho_eu_2');
