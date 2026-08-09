
ALTER TABLE public.esc_events ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
CREATE INDEX IF NOT EXISTS idx_esc_events_tenant ON public.esc_events(tenant_id);

-- Backfill from customer
UPDATE public.esc_events e
SET tenant_id = public.tenant_id_for_source(c.source_system)
FROM public.customers c
WHERE e.tenant_id IS NULL AND e.customer_id = c.id AND c.source_system IS NOT NULL;

-- Auto-assign tenant on insert (customer relation, else creator's single tenant)
CREATE OR REPLACE FUNCTION public.esc_events_set_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  src text;
  codes text[];
BEGIN
  IF NEW.tenant_id IS NOT NULL THEN RETURN NEW; END IF;

  IF NEW.customer_id IS NOT NULL THEN
    SELECT c.source_system INTO src FROM public.customers c WHERE c.id = NEW.customer_id;
  END IF;

  IF src IS NOT NULL THEN
    NEW.tenant_id := public.tenant_id_for_source(src);
    RETURN NEW;
  END IF;

  codes := public.user_tenant_codes();
  IF array_length(codes, 1) = 1 THEN
    SELECT t.id INTO NEW.tenant_id FROM public.tenants t WHERE t.code = codes[1] LIMIT 1;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_esc_events_tenant ON public.esc_events;
CREATE TRIGGER trg_esc_events_tenant
BEFORE INSERT ON public.esc_events
FOR EACH ROW EXECUTE FUNCTION public.esc_events_set_tenant();

-- Restrictive tenant policies on events
DROP POLICY IF EXISTS tenant_data_scope_all ON public.esc_events;
CREATE POLICY tenant_data_scope_all ON public.esc_events
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.tenant_scope_id_ok(tenant_id))
  WITH CHECK (public.tenant_scope_id_ok(tenant_id));

-- Helper for child tables
CREATE OR REPLACE FUNCTION public.esc_event_tenant_ok(_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT _event_id IS NULL
      OR (NOT public.tenant_scope_restricted())
      OR public.tenant_scope_id_ok((SELECT e.tenant_id FROM public.esc_events e WHERE e.id = _event_id));
$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['esc_event_participants','esc_event_resources','esc_event_emails'] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema='public' AND table_name=t AND column_name='event_id') THEN
      EXECUTE format('DROP POLICY IF EXISTS tenant_data_scope_all ON public.%I', t);
      EXECUTE format(
        'CREATE POLICY tenant_data_scope_all ON public.%I AS RESTRICTIVE FOR ALL TO authenticated
           USING (public.esc_event_tenant_ok(event_id))
           WITH CHECK (public.esc_event_tenant_ok(event_id))', t);
    END IF;
  END LOOP;
END $$;
