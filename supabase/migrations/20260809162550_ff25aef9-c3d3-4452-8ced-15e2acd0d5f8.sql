
ALTER TABLE public.collect_cases ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
CREATE INDEX IF NOT EXISTS idx_collect_cases_tenant ON public.collect_cases(tenant_id);

UPDATE public.collect_cases cc
SET tenant_id = public.tenant_id_for_source(c.source_system)
FROM public.customers c
WHERE cc.tenant_id IS NULL AND cc.customer_id = c.id AND c.source_system IS NOT NULL;

DROP TRIGGER IF EXISTS trg_collect_cases_tenant ON public.collect_cases;
CREATE TRIGGER trg_collect_cases_tenant
BEFORE INSERT ON public.collect_cases
FOR EACH ROW EXECUTE FUNCTION public.set_tenant_from_relation();

-- Helpers
CREATE OR REPLACE FUNCTION public.collect_case_tenant_ok(_case_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT _case_id IS NULL
      OR (NOT public.tenant_scope_restricted())
      OR public.tenant_scope_id_ok((SELECT c.tenant_id FROM public.collect_cases c WHERE c.id = _case_id));
$$;

CREATE OR REPLACE FUNCTION public.customer_tenant_ok(_customer_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT _customer_id IS NULL
      OR (NOT public.tenant_scope_restricted())
      OR public.tenant_scope_ok((SELECT c.source_system FROM public.customers c WHERE c.id = _customer_id));
$$;

DROP POLICY IF EXISTS tenant_data_scope_all ON public.collect_cases;
CREATE POLICY tenant_data_scope_all ON public.collect_cases
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.tenant_scope_id_ok(tenant_id))
  WITH CHECK (public.tenant_scope_id_ok(tenant_id));

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'collect_case_items','collect_events','collect_tasks','collect_promises','collect_payment_plans',
    'collect_calls','collect_documents','collect_dossiers','collect_legal_cases','collect_insolvencies',
    'collect_blocks','collect_device_links','collect_payment_links','collect_payment_term_changes'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS tenant_data_scope_all ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY tenant_data_scope_all ON public.%I AS RESTRICTIVE FOR ALL TO authenticated
         USING (public.collect_case_tenant_ok(case_id))
         WITH CHECK (public.collect_case_tenant_ok(case_id))', t);
  END LOOP;

  FOREACH t IN ARRAY ARRAY['collect_credit_checks','collect_credit_limits','collect_health_scores'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS tenant_data_scope_all ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY tenant_data_scope_all ON public.%I AS RESTRICTIVE FOR ALL TO authenticated
         USING (public.customer_tenant_ok(customer_id))
         WITH CHECK (public.customer_tenant_ok(customer_id))', t);
  END LOOP;
END $$;
