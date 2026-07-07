
DROP POLICY IF EXISTS "authenticated users can read roles" ON public.roles;

DROP POLICY IF EXISTS "financing role can read customers" ON public.customers;
CREATE POLICY "financing role can read financing customers"
  ON public.customers
  FOR SELECT
  TO authenticated
  USING (
    has_role('Finanzierungen'::text)
    AND EXISTS (
      SELECT 1
      FROM public.bank_financing_requests bfr
      JOIN public.orders o ON o.id = bfr.order_id
      WHERE o.customer_id = customers.id
    )
  );
