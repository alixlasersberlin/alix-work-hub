-- 1) Backfill tenant_id where derivable
UPDATE public.commission_entries ce
   SET tenant_id = public.tenant_id_for_source(o.source_system)
  FROM public.orders o
 WHERE ce.tenant_id IS NULL AND ce.order_id = o.id;

UPDATE public.commission_entries ce
   SET tenant_id = public.tenant_id_for_source(c.source_system)
  FROM public.customers c
 WHERE ce.tenant_id IS NULL AND ce.customer_id = c.id;

UPDATE public.finance_records fr
   SET tenant_id = public.tenant_id_for_source(o.source_system)
  FROM public.orders o
 WHERE fr.tenant_id IS NULL AND fr.order_id = o.id;

UPDATE public.payment_risk_flags pf
   SET tenant_id = public.tenant_id_for_source(c.source_system)
  FROM public.customers c
 WHERE pf.tenant_id IS NULL AND pf.customer_id = c.id;

-- 2) Restrictive tenant policies for remaining tenant_id tables
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['bank_transactions','commission_entries','finance_records','iso_audits','payment_risk_flags','pdf_order_imports','ratenplan_generated_invoices']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS tenant_data_scope_all ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY tenant_data_scope_all ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.tenant_scope_id_ok(tenant_id)) WITH CHECK (public.tenant_scope_id_ok(tenant_id))', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_tenant ON public.%I (tenant_id)', t, t);
  END LOOP;
END $$;

-- 3) Tickets: tenant scope via source_system
DROP POLICY IF EXISTS tenant_data_scope_all ON public.tickets;
CREATE POLICY tenant_data_scope_all ON public.tickets
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.tenant_scope_ok(source_system))
  WITH CHECK (public.tenant_scope_ok(source_system));

CREATE INDEX IF NOT EXISTS idx_tickets_source_system ON public.tickets (source_system);