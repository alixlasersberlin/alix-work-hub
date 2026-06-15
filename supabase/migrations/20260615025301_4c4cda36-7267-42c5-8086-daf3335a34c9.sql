ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS contact_tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS supplier_tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_customers_contact_tenant ON public.customers(contact_tenant_id);
CREATE INDEX IF NOT EXISTS idx_customers_supplier_tenant ON public.customers(supplier_tenant_id);