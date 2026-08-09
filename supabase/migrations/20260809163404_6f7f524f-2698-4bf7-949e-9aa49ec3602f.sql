UPDATE public.alixsmart_device_links d SET tenant_id = l.tenant_id
FROM public.alixsmart_customer_links l
WHERE d.customer_link_id = l.id AND d.tenant_id IS NULL;

CREATE OR REPLACE FUNCTION public.asm_device_set_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.tenant_id IS NULL AND NEW.alixwork_customer_id IS NOT NULL THEN
    SELECT t.id INTO NEW.tenant_id
    FROM public.customers c
    JOIN public.tenants t ON t.code = public.source_to_tenant_code(c.source_system)
    WHERE c.id = NEW.alixwork_customer_id;
  END IF;
  IF NEW.tenant_id IS NULL AND NEW.customer_link_id IS NOT NULL THEN
    SELECT l.tenant_id INTO NEW.tenant_id FROM public.alixsmart_customer_links l WHERE l.id = NEW.customer_link_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tenant_asm_device_links ON public.alixsmart_device_links;
CREATE TRIGGER trg_tenant_asm_device_links BEFORE INSERT OR UPDATE ON public.alixsmart_device_links
FOR EACH ROW EXECUTE FUNCTION public.asm_device_set_tenant();