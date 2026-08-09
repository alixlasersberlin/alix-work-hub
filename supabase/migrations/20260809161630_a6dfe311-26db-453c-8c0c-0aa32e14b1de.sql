-- 1) Scope-Prüfung anhand tenant_id -------------------------------------
CREATE OR REPLACE FUNCTION public.tenant_scope_id_ok(_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT _tenant_id IS NULL
      OR (NOT public.tenant_scope_restricted())
      OR EXISTS (
           SELECT 1 FROM public.tenants t
            WHERE t.id = _tenant_id
              AND t.code = ANY (public.user_tenant_codes())
         );
$$;
GRANT EXECUTE ON FUNCTION public.tenant_scope_id_ok(uuid) TO authenticated, anon, service_role;

-- Mandant zu einer Herkunft ermitteln
CREATE OR REPLACE FUNCTION public.tenant_id_for_source(_source text)
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT t.id FROM public.tenants t
   WHERE t.code = public.source_to_tenant_code(_source)
   LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.tenant_id_for_source(text) TO authenticated, service_role;

-- 2) Spalte tenant_id ergänzen -------------------------------------------
ALTER TABLE public.offers                ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
ALTER TABLE public.repair_orders         ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
ALTER TABLE public.sales_leads           ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
ALTER TABLE public.production_orders     ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
ALTER TABLE public.delivery_tours        ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
ALTER TABLE public.delivery_appointments ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
ALTER TABLE public.alixdocs2_documents   ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);

CREATE INDEX IF NOT EXISTS idx_offers_tenant ON public.offers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_repair_orders_tenant ON public.repair_orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sales_leads_tenant ON public.sales_leads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_production_orders_tenant ON public.production_orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_delivery_tours_tenant ON public.delivery_tours(tenant_id);
CREATE INDEX IF NOT EXISTS idx_delivery_appointments_tenant ON public.delivery_appointments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_alixdocs2_documents_tenant ON public.alixdocs2_documents(tenant_id);

-- 3) Backfill aus Auftrag/Kunde ------------------------------------------
UPDATE public.repair_orders r SET tenant_id = public.tenant_id_for_source(o.source_system)
  FROM public.orders o WHERE o.id = r.order_id AND r.tenant_id IS NULL;
UPDATE public.repair_orders r SET tenant_id = public.tenant_id_for_source(c.source_system)
  FROM public.customers c WHERE c.id = r.customer_id AND r.tenant_id IS NULL;

UPDATE public.production_orders p SET tenant_id = public.tenant_id_for_source(o.source_system)
  FROM public.orders o WHERE o.id = p.order_id AND p.tenant_id IS NULL;
UPDATE public.production_orders p SET tenant_id = public.tenant_id_for_source(c.source_system)
  FROM public.customers c WHERE c.id = p.customer_id AND p.tenant_id IS NULL;

UPDATE public.delivery_appointments d SET tenant_id = public.tenant_id_for_source(o.source_system)
  FROM public.orders o WHERE o.id = d.order_id AND d.tenant_id IS NULL;
UPDATE public.delivery_appointments d SET tenant_id = public.tenant_id_for_source(c.source_system)
  FROM public.customers c WHERE c.id = d.customer_id AND d.tenant_id IS NULL;

UPDATE public.offers f SET tenant_id = public.tenant_id_for_source(c.source_system)
  FROM public.customers c WHERE c.id = f.customer_id AND f.tenant_id IS NULL;

-- 4) Trigger: Mandant beim Anlegen automatisch setzen ---------------------
CREATE OR REPLACE FUNCTION public.set_tenant_from_relation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  src text;
BEGIN
  IF NEW.tenant_id IS NOT NULL THEN RETURN NEW; END IF;

  IF to_jsonb(NEW) ? 'order_id' AND (to_jsonb(NEW)->>'order_id') IS NOT NULL THEN
    SELECT o.source_system INTO src FROM public.orders o
     WHERE o.id = (to_jsonb(NEW)->>'order_id')::uuid;
  END IF;

  IF src IS NULL AND to_jsonb(NEW) ? 'customer_id' AND (to_jsonb(NEW)->>'customer_id') IS NOT NULL THEN
    SELECT c.source_system INTO src FROM public.customers c
     WHERE c.id = (to_jsonb(NEW)->>'customer_id')::uuid;
  END IF;

  IF src IS NOT NULL THEN
    NEW.tenant_id := public.tenant_id_for_source(src);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tenant_repair_orders ON public.repair_orders;
CREATE TRIGGER trg_tenant_repair_orders BEFORE INSERT ON public.repair_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_from_relation();
DROP TRIGGER IF EXISTS trg_tenant_production_orders ON public.production_orders;
CREATE TRIGGER trg_tenant_production_orders BEFORE INSERT ON public.production_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_from_relation();
DROP TRIGGER IF EXISTS trg_tenant_delivery_appointments ON public.delivery_appointments;
CREATE TRIGGER trg_tenant_delivery_appointments BEFORE INSERT ON public.delivery_appointments
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_from_relation();
DROP TRIGGER IF EXISTS trg_tenant_offers ON public.offers;
CREATE TRIGGER trg_tenant_offers BEFORE INSERT ON public.offers
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_from_relation();

-- 5) Restriktive Scope-Policies ------------------------------------------
DO $do$
DECLARE
  t text;
  tables text[] := ARRAY['offers','repair_orders','sales_leads','production_orders',
                         'delivery_tours','delivery_appointments','alixdocs2_documents',
                         'alixdocs_documents'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS tenant_data_scope_select ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_data_scope_write ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_data_scope_delete ON public.%I', t);
    EXECUTE format('CREATE POLICY tenant_data_scope_select ON public.%I AS RESTRICTIVE FOR SELECT USING (public.tenant_scope_id_ok(tenant_id))', t);
    EXECUTE format('CREATE POLICY tenant_data_scope_write ON public.%I AS RESTRICTIVE FOR UPDATE USING (public.tenant_scope_id_ok(tenant_id)) WITH CHECK (public.tenant_scope_id_ok(tenant_id))', t);
    EXECUTE format('CREATE POLICY tenant_data_scope_delete ON public.%I AS RESTRICTIVE FOR DELETE USING (public.tenant_scope_id_ok(tenant_id))', t);
  END LOOP;
END
$do$;