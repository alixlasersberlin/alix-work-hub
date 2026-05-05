ALTER TABLE public.zoho_unpaid_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "finance can read zoho unpaid invoices"
ON public.zoho_unpaid_invoices FOR SELECT TO authenticated
USING (can_access_finance());

CREATE POLICY "admins can insert zoho unpaid invoices"
ON public.zoho_unpaid_invoices FOR INSERT TO authenticated
WITH CHECK (is_admin());

CREATE POLICY "admins can update zoho unpaid invoices"
ON public.zoho_unpaid_invoices FOR UPDATE TO authenticated
USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "admins can delete zoho unpaid invoices"
ON public.zoho_unpaid_invoices FOR DELETE TO authenticated
USING (is_admin());

CREATE UNIQUE INDEX IF NOT EXISTS zoho_unpaid_invoices_invoice_id_key
ON public.zoho_unpaid_invoices(invoice_id);