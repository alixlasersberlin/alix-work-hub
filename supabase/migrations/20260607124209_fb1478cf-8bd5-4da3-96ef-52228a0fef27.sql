
-- Phase 11: Customer Portal 2.0 — portal-scoped SELECT policies

-- warranty_records: portal customer sees their own
CREATE POLICY portal_customer_select_own_warranty
ON public.warranty_records FOR SELECT
USING (customer_id = public.current_portal_customer_id());

-- device_maintenance: portal customer sees their own
CREATE POLICY portal_customer_select_own_maintenance
ON public.device_maintenance FOR SELECT
USING (customer_id = public.current_portal_customer_id());

-- device_lifecycle: portal customer sees their own
CREATE POLICY portal_customer_select_own_lifecycle
ON public.device_lifecycle FOR SELECT
USING (customer_id = public.current_portal_customer_id());

-- device_health_scores: scoped via lifecycle ownership of same serial
CREATE POLICY portal_customer_select_own_health
ON public.device_health_scores FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.device_lifecycle dl
    WHERE dl.serial_number = device_health_scores.serial_number
      AND dl.customer_id = public.current_portal_customer_id()
  )
);

-- lager_devices: portal customer sees devices reserved on their orders
CREATE POLICY portal_customer_select_own_devices
ON public.lager_devices FOR SELECT
USING (
  reserved_order_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = lager_devices.reserved_order_id
      AND o.customer_id = public.current_portal_customer_id()
  )
);

-- tickets: portal customer sees tickets matched by email
CREATE POLICY portal_customer_select_own_tickets
ON public.tickets FOR SELECT
USING (
  customer_email IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.customer_portal_users cpu
    JOIN public.customers c ON c.id = cpu.customer_id
    WHERE cpu.user_id = auth.uid()
      AND cpu.status = 'active'
      AND lower(c.email) = lower(tickets.customer_email)
  )
);
