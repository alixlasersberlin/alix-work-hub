
-- Backfill tenant on repair orders
UPDATE public.repair_orders r
SET tenant_id = public.tenant_id_for_source(o.source_system)
FROM public.orders o
WHERE r.tenant_id IS NULL AND r.order_id = o.id AND o.source_system IS NOT NULL;

UPDATE public.repair_orders r
SET tenant_id = public.tenant_id_for_source(c.source_system)
FROM public.customers c
WHERE r.tenant_id IS NULL AND r.customer_id = c.id AND c.source_system IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_repair_orders_tenant ON public.repair_orders(tenant_id);

DROP TRIGGER IF EXISTS trg_repair_orders_tenant ON public.repair_orders;
CREATE TRIGGER trg_repair_orders_tenant
BEFORE INSERT ON public.repair_orders
FOR EACH ROW EXECUTE FUNCTION public.set_tenant_from_relation();

-- Helpers
CREATE OR REPLACE FUNCTION public.repair_tenant_ok(_repair_order_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT _repair_order_id IS NULL
      OR (NOT public.tenant_scope_restricted())
      OR public.tenant_scope_id_ok((SELECT r.tenant_id FROM public.repair_orders r WHERE r.id = _repair_order_id));
$$;

CREATE OR REPLACE FUNCTION public.repair_quote_tenant_ok(_quote_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT _quote_id IS NULL
      OR (NOT public.tenant_scope_restricted())
      OR public.repair_tenant_ok((SELECT q.repair_order_id FROM public.repair_quotes q WHERE q.id = _quote_id));
$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'repair_attachments','repair_communications','repair_delivery_handover','repair_finance_handover',
    'repair_invoice_proposals','repair_parts','repair_quotes','repair_signatures','repair_spare_parts',
    'repair_status_history','repair_work_orders','repair_workshop_intake'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS tenant_data_scope_all ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY tenant_data_scope_all ON public.%I AS RESTRICTIVE FOR ALL TO authenticated
         USING (public.repair_tenant_ok(repair_order_id))
         WITH CHECK (public.repair_tenant_ok(repair_order_id))', t);
  END LOOP;

  FOREACH t IN ARRAY ARRAY['repair_quote_items','repair_quote_history'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS tenant_data_scope_all ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY tenant_data_scope_all ON public.%I AS RESTRICTIVE FOR ALL TO authenticated
         USING (public.repair_quote_tenant_ok(quote_id))
         WITH CHECK (public.repair_quote_tenant_ok(quote_id))', t);
  END LOOP;
END $$;
