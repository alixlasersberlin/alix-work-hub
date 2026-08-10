CREATE INDEX IF NOT EXISTS idx_zoho_invoices_mietkauf_id ON public.zoho_invoices (is_mietkauf, id DESC);
CREATE INDEX IF NOT EXISTS idx_zoho_invoices_region_mietkauf_id ON public.zoho_invoices (accounting_region, is_mietkauf, id DESC);
CREATE INDEX IF NOT EXISTS idx_zoho_recurring_invoices_mietkauf_id ON public.zoho_recurring_invoices (is_mietkauf, id DESC);
CREATE INDEX IF NOT EXISTS idx_zoho_unpaid_invoices_id_desc ON public.zoho_unpaid_invoices (id DESC);