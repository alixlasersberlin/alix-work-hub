
-- Restrict system_maintenance read to authenticated users only
DROP POLICY IF EXISTS "Anyone can read maintenance status" ON public.system_maintenance;
CREATE POLICY "Authenticated can read maintenance status"
  ON public.system_maintenance
  FOR SELECT
  TO authenticated
  USING (true);
REVOKE SELECT ON public.system_maintenance FROM anon;

-- Document reviewed realtime tables with sales/pricing data
COMMENT ON TABLE public.order_items IS
  'Realtime-published. SELECT is role-scoped via can_access_orders(); do NOT weaken without security review.';
COMMENT ON TABLE public.offer_followup_tasks IS
  'Realtime-published. SELECT restricted to admin/sales/order roles or task owner; do NOT weaken without security review.';
COMMENT ON TABLE public.offer_outcomes IS
  'Realtime-published. SELECT restricted to admin/sales/order/finance roles; do NOT weaken without security review.';
