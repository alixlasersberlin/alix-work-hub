
CREATE POLICY "repair role can read orders" ON public.orders
  FOR SELECT TO authenticated
  USING (public.can_access_repair());

CREATE POLICY "repair role can read customers" ON public.customers
  FOR SELECT TO authenticated
  USING (public.can_access_repair());
