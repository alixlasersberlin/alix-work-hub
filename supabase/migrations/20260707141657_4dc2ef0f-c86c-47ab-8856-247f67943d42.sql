
-- Drop overly-broad Österreich policy on order_items (sibling scoped policy remains)
DROP POLICY IF EXISTS "at role can read ch order items" ON public.order_items;

-- Replace unscoped financing policies with financing-linked scoping
DROP POLICY IF EXISTS "financing role can read orders" ON public.orders;
CREATE POLICY "financing role can read financing orders"
  ON public.orders FOR SELECT
  TO authenticated
  USING (
    has_role('Finanzierungen')
    AND EXISTS (
      SELECT 1 FROM public.bank_financing_requests bfr
      WHERE bfr.order_id = orders.id
    )
  );

DROP POLICY IF EXISTS "financing role can read order items" ON public.order_items;
CREATE POLICY "financing role can read financing order items"
  ON public.order_items FOR SELECT
  TO authenticated
  USING (
    has_role('Finanzierungen')
    AND EXISTS (
      SELECT 1
      FROM public.bank_financing_requests bfr
      WHERE bfr.order_id = order_items.order_id
    )
  );
