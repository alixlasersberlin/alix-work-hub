
CREATE TABLE public.zoho_recurring_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_system text NOT NULL,
  zoho_invoice_id text NOT NULL,
  zoho_recurring_invoice_id text,
  invoice_number text,
  reference_number text,
  customer_name text,
  customer_id text,
  device_name text,
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
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_system, zoho_invoice_id)
);

CREATE INDEX idx_zri_invoice_date ON public.zoho_recurring_invoices(invoice_date DESC);
CREATE INDEX idx_zri_customer ON public.zoho_recurring_invoices(customer_name);
CREATE INDEX idx_zri_reference ON public.zoho_recurring_invoices(reference_number);

ALTER TABLE public.zoho_recurring_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "finance can read recurring invoices"
  ON public.zoho_recurring_invoices FOR SELECT TO authenticated
  USING (public.can_access_finance());

CREATE POLICY "admins can insert recurring invoices"
  ON public.zoho_recurring_invoices FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "admins can update recurring invoices"
  ON public.zoho_recurring_invoices FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "admins can delete recurring invoices"
  ON public.zoho_recurring_invoices FOR DELETE TO authenticated
  USING (public.is_admin());

CREATE TRIGGER trg_zri_updated_at
  BEFORE UPDATE ON public.zoho_recurring_invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
