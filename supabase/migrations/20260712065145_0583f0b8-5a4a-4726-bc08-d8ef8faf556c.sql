
ALTER TABLE public.finance_records          ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
ALTER TABLE public.zoho_invoices            ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
ALTER TABLE public.zoho_unpaid_invoices     ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
ALTER TABLE public.zoho_recurring_invoices  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
ALTER TABLE public.zoho_recurring_profiles  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);

-- Backfill zoho_* via source_system
UPDATE public.zoho_invoices z SET tenant_id = t.id
  FROM public.tenants t
 WHERE z.tenant_id IS NULL AND z.source_system IS NOT NULL AND t.zoho_source_system = z.source_system;

UPDATE public.zoho_recurring_invoices z SET tenant_id = t.id
  FROM public.tenants t
 WHERE z.tenant_id IS NULL AND z.source_system IS NOT NULL AND t.zoho_source_system = z.source_system;

UPDATE public.zoho_recurring_profiles z SET tenant_id = t.id
  FROM public.tenants t
 WHERE z.tenant_id IS NULL AND z.source_system IS NOT NULL AND t.zoho_source_system = z.source_system;

-- Backfill zoho_unpaid_invoices via matching invoice_number in zoho_invoices
UPDATE public.zoho_unpaid_invoices u SET tenant_id = z.tenant_id
  FROM public.zoho_invoices z
 WHERE u.tenant_id IS NULL AND z.tenant_id IS NOT NULL AND u.invoice_number = z.invoice_number;

-- Backfill finance_records via orders.source_system
UPDATE public.finance_records fr SET tenant_id = t.id
  FROM public.orders o
  JOIN public.tenants t ON t.zoho_source_system = o.source_system
 WHERE fr.tenant_id IS NULL AND fr.order_id = o.id AND o.source_system IS NOT NULL;

-- Tenant-scoped SELECT policies
DROP POLICY IF EXISTS "authorized roles can read finance records" ON public.finance_records;
CREATE POLICY "authorized roles can read finance records"
  ON public.finance_records FOR SELECT
  USING (can_access_finance() AND (has_role('Super Admin') OR (tenant_id IS NOT NULL AND has_tenant_access(tenant_id))));

DROP POLICY IF EXISTS "finance can read zoho invoices" ON public.zoho_invoices;
CREATE POLICY "finance can read zoho invoices"
  ON public.zoho_invoices FOR SELECT
  USING (can_access_finance() AND (has_role('Super Admin') OR (tenant_id IS NOT NULL AND has_tenant_access(tenant_id))));

DROP POLICY IF EXISTS "finance can read zoho unpaid invoices" ON public.zoho_unpaid_invoices;
CREATE POLICY "finance can read zoho unpaid invoices"
  ON public.zoho_unpaid_invoices FOR SELECT
  USING (can_access_finance() AND (has_role('Super Admin') OR (tenant_id IS NOT NULL AND has_tenant_access(tenant_id))));

DROP POLICY IF EXISTS "finance can read recurring invoices" ON public.zoho_recurring_invoices;
CREATE POLICY "finance can read recurring invoices"
  ON public.zoho_recurring_invoices FOR SELECT
  USING (can_access_finance() AND (has_role('Super Admin') OR (tenant_id IS NOT NULL AND has_tenant_access(tenant_id))));

DROP POLICY IF EXISTS "finance can read recurring profiles" ON public.zoho_recurring_profiles;
CREATE POLICY "finance can read recurring profiles"
  ON public.zoho_recurring_profiles FOR SELECT
  USING (can_access_finance() AND (has_role('Super Admin') OR (tenant_id IS NOT NULL AND has_tenant_access(tenant_id))));

-- Auto-set tenant_id on insert/update
CREATE OR REPLACE FUNCTION public.set_zoho_tenant_id_from_source_system()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.tenant_id IS NULL AND NEW.source_system IS NOT NULL THEN
    SELECT id INTO NEW.tenant_id FROM public.tenants WHERE zoho_source_system = NEW.source_system LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_zoho_invoices_set_tenant ON public.zoho_invoices;
CREATE TRIGGER trg_zoho_invoices_set_tenant BEFORE INSERT OR UPDATE ON public.zoho_invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_zoho_tenant_id_from_source_system();

DROP TRIGGER IF EXISTS trg_zoho_recurring_invoices_set_tenant ON public.zoho_recurring_invoices;
CREATE TRIGGER trg_zoho_recurring_invoices_set_tenant BEFORE INSERT OR UPDATE ON public.zoho_recurring_invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_zoho_tenant_id_from_source_system();

DROP TRIGGER IF EXISTS trg_zoho_recurring_profiles_set_tenant ON public.zoho_recurring_profiles;
CREATE TRIGGER trg_zoho_recurring_profiles_set_tenant BEFORE INSERT OR UPDATE ON public.zoho_recurring_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_zoho_tenant_id_from_source_system();

-- Trigger for zoho_unpaid_invoices: match by invoice_number
CREATE OR REPLACE FUNCTION public.set_zoho_unpaid_tenant_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.tenant_id IS NULL AND NEW.invoice_number IS NOT NULL THEN
    SELECT tenant_id INTO NEW.tenant_id FROM public.zoho_invoices WHERE invoice_number = NEW.invoice_number LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_zoho_unpaid_invoices_set_tenant ON public.zoho_unpaid_invoices;
CREATE TRIGGER trg_zoho_unpaid_invoices_set_tenant BEFORE INSERT OR UPDATE ON public.zoho_unpaid_invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_zoho_unpaid_tenant_id();

-- Trigger for finance_records: inherit from order
CREATE OR REPLACE FUNCTION public.set_finance_records_tenant_id_from_order()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.tenant_id IS NULL AND NEW.order_id IS NOT NULL THEN
    SELECT t.id INTO NEW.tenant_id
      FROM public.orders o
      JOIN public.tenants t ON t.zoho_source_system = o.source_system
     WHERE o.id = NEW.order_id LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_finance_records_set_tenant ON public.finance_records;
CREATE TRIGGER trg_finance_records_set_tenant BEFORE INSERT OR UPDATE ON public.finance_records
  FOR EACH ROW EXECUTE FUNCTION public.set_finance_records_tenant_id_from_order();

CREATE INDEX IF NOT EXISTS idx_finance_records_tenant_id         ON public.finance_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_zoho_invoices_tenant_id           ON public.zoho_invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_zoho_unpaid_invoices_tenant_id    ON public.zoho_unpaid_invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_zoho_recurring_invoices_tenant_id ON public.zoho_recurring_invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_zoho_recurring_profiles_tenant_id ON public.zoho_recurring_profiles(tenant_id);
