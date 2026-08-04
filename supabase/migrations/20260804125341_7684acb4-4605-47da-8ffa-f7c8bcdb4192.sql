CREATE INDEX IF NOT EXISTS idx_zoho_invoices_region_mietkauf_date ON public.zoho_invoices (accounting_region, is_mietkauf, invoice_date DESC);
CREATE INDEX IF NOT EXISTS idx_zri_mietkauf_date ON public.zoho_recurring_invoices (is_mietkauf, invoice_date DESC);
CREATE INDEX IF NOT EXISTS idx_zoho_invoices_region_balance_due ON public.zoho_invoices (accounting_region, due_date) WHERE balance > 0;
CREATE INDEX IF NOT EXISTS idx_zri_region_balance_due ON public.zoho_recurring_invoices (accounting_region, due_date) WHERE balance > 0;