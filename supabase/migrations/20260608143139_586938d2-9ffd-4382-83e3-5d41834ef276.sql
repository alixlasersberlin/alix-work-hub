-- Restrict portal customer RLS policies to authenticated role only
DROP POLICY IF EXISTS portal_customer_select_own_health ON public.device_health_scores;
CREATE POLICY portal_customer_select_own_health ON public.device_health_scores
  FOR SELECT TO authenticated
  USING (
    serial_number IN (
      SELECT serial_number FROM public.device_lifecycle
      WHERE customer_id = public.current_portal_customer_id()
    )
  );

DROP POLICY IF EXISTS portal_customer_select_own_lifecycle ON public.device_lifecycle;
CREATE POLICY portal_customer_select_own_lifecycle ON public.device_lifecycle
  FOR SELECT TO authenticated
  USING (customer_id = public.current_portal_customer_id());

DROP POLICY IF EXISTS portal_customer_select_own_warranty ON public.warranty_records;
CREATE POLICY portal_customer_select_own_warranty ON public.warranty_records
  FOR SELECT TO authenticated
  USING (customer_id = public.current_portal_customer_id());

DROP POLICY IF EXISTS portal_customer_select_own_maintenance ON public.device_maintenance;
CREATE POLICY portal_customer_select_own_maintenance ON public.device_maintenance
  FOR SELECT TO authenticated
  USING (customer_id = public.current_portal_customer_id());

DROP POLICY IF EXISTS portal_customer_select_own_devices ON public.lager_devices;
CREATE POLICY portal_customer_select_own_devices ON public.lager_devices
  FOR SELECT TO authenticated
  USING (
    reserved_order_id IN (
      SELECT id FROM public.orders
      WHERE customer_id = public.current_portal_customer_id()
    )
  );