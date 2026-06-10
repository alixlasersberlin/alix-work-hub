
CREATE POLICY "at role can read ch orders"
ON public.orders FOR SELECT
USING (has_role('Österreich') AND source_system = 'zoho_eu_1' AND raw_data->>'branch_id' = '598077000000065075');

CREATE POLICY "at role can read ch customers"
ON public.customers FOR SELECT
USING (
  has_role('Österreich')
  AND source_system = 'zoho_eu_1'
  AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.customer_id = customers.id
      AND o.source_system = 'zoho_eu_1'
      AND o.raw_data->>'branch_id' = '598077000000065075'
  )
);

CREATE POLICY "at role can read ch order items"
ON public.order_items FOR SELECT
USING (
  has_role('Österreich')
  AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id
      AND o.source_system = 'zoho_eu_1'
      AND o.raw_data->>'branch_id' = '598077000000065075'
  )
);
