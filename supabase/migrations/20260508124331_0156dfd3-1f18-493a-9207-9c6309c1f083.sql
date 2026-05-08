CREATE POLICY "planning roles read reserved lager devices"
ON public.lager_devices
FOR SELECT
TO authenticated
USING (
  reserved_order_id IS NOT NULL
  AND (public.can_access_planning() OR public.can_access_orders())
);