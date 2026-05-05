CREATE TABLE public.zoho_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_system text NOT NULL,
  zoho_invoice_id text NOT NULL,
  invoice_number text,
  reference_number text,
  customer_id text,
  customer_name text,
  city text,
  billing_address jsonb,
  invoice_date date,
  due_date date,
  currency text,
  total numeric,
  balance numeric,
  status text,
  payment_status text,
  last_payment_date date,
  raw_data jsonb,
  synced_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (source_system, zoho_invoice_id)
);

ALTER TABLE public.zoho_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "finance can read zoho invoices"
  ON public.zoho_invoices FOR SELECT TO authenticated
  USING (can_access_finance());

CREATE POLICY "admins can insert zoho invoices"
  ON public.zoho_invoices FOR INSERT TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "admins can update zoho invoices"
  ON public.zoho_invoices FOR UPDATE TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "admins can delete zoho invoices"
  ON public.zoho_invoices FOR DELETE TO authenticated
  USING (is_admin());

CREATE TRIGGER set_zoho_invoices_updated_at
  BEFORE UPDATE ON public.zoho_invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_zoho_invoices_invoice_date ON public.zoho_invoices(invoice_date DESC);
CREATE INDEX idx_zoho_invoices_customer ON public.zoho_invoices(customer_name);