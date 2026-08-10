DROP POLICY IF EXISTS "tenant_data_scope_select" ON public.zoho_invoices;
DROP POLICY IF EXISTS "tenant_data_scope_select" ON public.zoho_recurring_invoices;
DROP POLICY IF EXISTS "tenant_data_scope_select" ON public.zoho_unpaid_invoices;

CREATE INDEX IF NOT EXISTS idx_zoho_invoices_tenant_mietkauf_id
  ON public.zoho_invoices (tenant_id, is_mietkauf, id DESC);

CREATE INDEX IF NOT EXISTS idx_zoho_recurring_invoices_tenant_mietkauf_id
  ON public.zoho_recurring_invoices (tenant_id, is_mietkauf, id DESC);

CREATE INDEX IF NOT EXISTS idx_zoho_unpaid_invoices_tenant_id_desc
  ON public.zoho_unpaid_invoices (tenant_id, id DESC);