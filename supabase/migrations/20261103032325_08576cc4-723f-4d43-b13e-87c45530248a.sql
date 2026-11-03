CREATE OR REPLACE FUNCTION public.sales_leads_default_tenant() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN NEW.tenant_id := '8e2ae7d9-8c34-46d1-9e6a-180e4871a905'::uuid; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_sales_leads_default_tenant ON public.sales_leads;
CREATE TRIGGER trg_sales_leads_default_tenant BEFORE INSERT ON public.sales_leads FOR EACH ROW EXECUTE FUNCTION public.sales_leads_default_tenant();
UPDATE public.sales_leads SET tenant_id='8e2ae7d9-8c34-46d1-9e6a-180e4871a905'::uuid WHERE tenant_id IS NULL;