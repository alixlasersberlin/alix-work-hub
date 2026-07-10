
DROP POLICY IF EXISTS "order_at_approval_select" ON public.order_at_approval;
CREATE POLICY "order_at_approval_select"
ON public.order_at_approval
FOR SELECT
TO authenticated
USING (
  has_role('Super Admin'::text)
  OR has_role('Admin'::text)
  OR (
    has_role('Österreich'::text)
    AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_at_approval.order_id
        AND o.source_system = 'zoho_eu_2'
    )
  )
);

DROP POLICY IF EXISTS "AT purchase read" ON public.order_at_purchase;
CREATE POLICY "AT purchase read"
ON public.order_at_purchase
FOR SELECT
TO authenticated
USING (
  has_role('Super Admin'::text)
  OR (
    has_role('Österreich'::text)
    AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_at_purchase.order_id
        AND o.source_system = 'zoho_eu_2'
    )
  )
);
