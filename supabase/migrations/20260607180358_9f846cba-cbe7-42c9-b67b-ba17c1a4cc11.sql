
DROP POLICY IF EXISTS "at role can update at orders" ON public.orders;
DROP POLICY IF EXISTS "at role can read at additional deposits" ON public.order_additional_deposits;
DROP POLICY IF EXISTS "at role can insert at additional deposits" ON public.order_additional_deposits;
DROP POLICY IF EXISTS "at role can update at additional deposits" ON public.order_additional_deposits;

CREATE POLICY "at role can update at orders"
ON public.orders FOR UPDATE
USING (has_role('Österreich') AND source_system = 'zoho_eu_2')
WITH CHECK (has_role('Österreich') AND source_system = 'zoho_eu_2');

CREATE POLICY "at role can read at additional deposits"
ON public.order_additional_deposits FOR SELECT
USING (
  has_role('Österreich') AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_additional_deposits.order_id
      AND o.source_system = 'zoho_eu_2'
  )
);

CREATE POLICY "at role can insert at additional deposits"
ON public.order_additional_deposits FOR INSERT
WITH CHECK (
  has_role('Österreich') AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_additional_deposits.order_id
      AND o.source_system = 'zoho_eu_2'
  )
);

CREATE POLICY "at role can update at additional deposits"
ON public.order_additional_deposits FOR UPDATE
USING (
  has_role('Österreich') AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_additional_deposits.order_id
      AND o.source_system = 'zoho_eu_2'
  )
)
WITH CHECK (
  has_role('Österreich') AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_additional_deposits.order_id
      AND o.source_system = 'zoho_eu_2'
  )
);
