-- 1. new tenant columns
ALTER TABLE public.media_packages ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.sig_documents ADD COLUMN IF NOT EXISTS tenant_id uuid;

-- 2. backfill via customer
UPDATE public.media_packages m SET tenant_id = t.id
FROM public.customers c JOIN public.tenants t ON t.code = public.source_to_tenant_code(c.source_system)
WHERE m.customer_id = c.id AND m.tenant_id IS NULL;

UPDATE public.sig_documents s SET tenant_id = t.id
FROM public.customers c JOIN public.tenants t ON t.code = public.source_to_tenant_code(c.source_system)
WHERE s.customer_id = c.id AND s.tenant_id IS NULL;

UPDATE public.alixsmart_customer_links l SET tenant_id = t.id
FROM public.customers c JOIN public.tenants t ON t.code = public.source_to_tenant_code(c.source_system)
WHERE l.alixwork_customer_id = c.id AND l.tenant_id IS NULL;

UPDATE public.alixsmart_device_links d SET tenant_id = t.id
FROM public.customers c JOIN public.tenants t ON t.code = public.source_to_tenant_code(c.source_system)
WHERE d.alixwork_customer_id = c.id AND d.tenant_id IS NULL;

-- 3. auto-assign triggers
CREATE OR REPLACE FUNCTION public.set_tenant_from_customer_col()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _cid uuid;
BEGIN
  IF NEW.tenant_id IS NULL THEN
    IF TG_TABLE_NAME IN ('alixsmart_customer_links','alixsmart_device_links') THEN
      _cid := NEW.alixwork_customer_id;
    ELSE
      _cid := NEW.customer_id;
    END IF;
    IF _cid IS NOT NULL THEN
      SELECT t.id INTO NEW.tenant_id
      FROM public.customers c
      JOIN public.tenants t ON t.code = public.source_to_tenant_code(c.source_system)
      WHERE c.id = _cid;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tenant_media_packages ON public.media_packages;
CREATE TRIGGER trg_tenant_media_packages BEFORE INSERT OR UPDATE ON public.media_packages
FOR EACH ROW EXECUTE FUNCTION public.set_tenant_from_customer_col();

DROP TRIGGER IF EXISTS trg_tenant_sig_documents ON public.sig_documents;
CREATE TRIGGER trg_tenant_sig_documents BEFORE INSERT OR UPDATE ON public.sig_documents
FOR EACH ROW EXECUTE FUNCTION public.set_tenant_from_customer_col();

DROP TRIGGER IF EXISTS trg_tenant_asm_customer_links ON public.alixsmart_customer_links;
CREATE TRIGGER trg_tenant_asm_customer_links BEFORE INSERT OR UPDATE ON public.alixsmart_customer_links
FOR EACH ROW EXECUTE FUNCTION public.set_tenant_from_customer_col();

DROP TRIGGER IF EXISTS trg_tenant_asm_device_links ON public.alixsmart_device_links;
CREATE TRIGGER trg_tenant_asm_device_links BEFORE INSERT OR UPDATE ON public.alixsmart_device_links
FOR EACH ROW EXECUTE FUNCTION public.set_tenant_from_customer_col();

-- 4. restrictive policies on tenant_id owners
DO $$
DECLARE tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['media_packages','sig_documents','alixsmart_customer_links','alixsmart_device_links'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS tenant_scope_%1$s ON public.%1$I', tbl);
    EXECUTE format('CREATE POLICY tenant_scope_%1$s ON public.%1$I AS RESTRICTIVE TO authenticated USING (public.tenant_scope_ok_id(tenant_id)) WITH CHECK (public.tenant_scope_ok_id(tenant_id))', tbl);
  END LOOP;
END $$;

-- 5. child tables scoped via parent
DO $$
DECLARE tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'media_package_branding','media_package_comments','media_package_consents','media_package_contact_data',
    'media_package_devices','media_package_files','media_package_history','media_package_opening_hours',
    'media_package_prices','media_package_services','media_package_studio_data','media_package_team_members',
    'media_package_treatments'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS tenant_scope_%1$s ON public.%1$I', tbl);
    EXECUTE format('CREATE POLICY tenant_scope_%1$s ON public.%1$I AS RESTRICTIVE TO authenticated USING (EXISTS (SELECT 1 FROM public.media_packages m WHERE m.id = %1$I.media_package_id AND public.tenant_scope_ok_id(m.tenant_id))) WITH CHECK (EXISTS (SELECT 1 FROM public.media_packages m WHERE m.id = %1$I.media_package_id AND public.tenant_scope_ok_id(m.tenant_id)))', tbl);
  END LOOP;
END $$;

ALTER TABLE public.media_package_file_downloads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_scope_media_package_file_downloads ON public.media_package_file_downloads;
CREATE POLICY tenant_scope_media_package_file_downloads ON public.media_package_file_downloads
AS RESTRICTIVE TO authenticated
USING (EXISTS (SELECT 1 FROM public.media_packages m WHERE m.id = media_package_file_downloads.media_package_id AND public.tenant_scope_ok_id(m.tenant_id)))
WITH CHECK (EXISTS (SELECT 1 FROM public.media_packages m WHERE m.id = media_package_file_downloads.media_package_id AND public.tenant_scope_ok_id(m.tenant_id)));

ALTER TABLE public.delivery_tour_stops ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_scope_delivery_tour_stops ON public.delivery_tour_stops;
CREATE POLICY tenant_scope_delivery_tour_stops ON public.delivery_tour_stops
AS RESTRICTIVE TO authenticated
USING (EXISTS (SELECT 1 FROM public.delivery_tours t WHERE t.id = delivery_tour_stops.tour_id AND public.tenant_scope_ok_id(t.tenant_id)))
WITH CHECK (EXISTS (SELECT 1 FROM public.delivery_tours t WHERE t.id = delivery_tour_stops.tour_id AND public.tenant_scope_ok_id(t.tenant_id)));

ALTER TABLE public.production_order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_scope_production_order_items ON public.production_order_items;
CREATE POLICY tenant_scope_production_order_items ON public.production_order_items
AS RESTRICTIVE TO authenticated
USING (EXISTS (SELECT 1 FROM public.production_orders p WHERE p.id = production_order_items.production_order_id AND public.tenant_scope_ok_id(p.tenant_id)))
WITH CHECK (EXISTS (SELECT 1 FROM public.production_orders p WHERE p.id = production_order_items.production_order_id AND public.tenant_scope_ok_id(p.tenant_id)));

ALTER TABLE public.order_change_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_scope_order_change_requests ON public.order_change_requests;
CREATE POLICY tenant_scope_order_change_requests ON public.order_change_requests
AS RESTRICTIVE TO authenticated
USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_change_requests.order_id AND public.tenant_scope_ok(o.source_system)))
WITH CHECK (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_change_requests.order_id AND public.tenant_scope_ok(o.source_system)));

-- 6. indexes
CREATE INDEX IF NOT EXISTS idx_media_packages_tenant ON public.media_packages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sig_documents_tenant ON public.sig_documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_asm_cust_links_tenant ON public.alixsmart_customer_links(tenant_id);
CREATE INDEX IF NOT EXISTS idx_asm_dev_links_tenant ON public.alixsmart_device_links(tenant_id);