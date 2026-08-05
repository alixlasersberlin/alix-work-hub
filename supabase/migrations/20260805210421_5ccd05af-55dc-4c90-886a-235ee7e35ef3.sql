DROP POLICY IF EXISTS "orders_select_consolidated" ON public.orders;

CREATE POLICY "orders_select_consolidated" ON public.orders
FOR SELECT
USING (
  (
    (
      (SELECT can_access_orders())
      OR (SELECT can_access_repair())
    )
    AND (
      NOT (SELECT has_role('Österreich'::text))
      OR COALESCE(accounting_region, 'EU') <> 'CH'
    )
  )
  OR ((SELECT has_role('Österreich'::text)) AND source_system = 'zoho_eu_2'::text)
  OR (
    (SELECT has_role('Finanzierungen'::text))
    AND EXISTS (SELECT 1 FROM bank_financing_requests bfr WHERE bfr.order_id = orders.id)
  )
  OR (customer_id = (SELECT current_portal_customer_id()))
);