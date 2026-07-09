-- Only Admin / Super Admin may update existing orders after they have been created.
-- INSERT (create) remains open to Auftragsverwaltung, Order, SACHBEARBEITUNG so the
-- normal order-creation flows keep working. UPDATE gets restricted to admin-only.

DROP POLICY IF EXISTS "authorized roles can update orders" ON public.orders;

CREATE POLICY "only admins can update orders"
ON public.orders
FOR UPDATE
USING (public.is_admin())
WITH CHECK (public.is_admin());
