DROP POLICY IF EXISTS "only admins can update orders" ON public.orders;

CREATE POLICY "only admins can update orders"
ON public.orders
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());