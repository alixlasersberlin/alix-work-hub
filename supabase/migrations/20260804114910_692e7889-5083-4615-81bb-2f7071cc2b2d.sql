CREATE TABLE IF NOT EXISTS public.ratenplan_invoice_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mode text NOT NULL DEFAULT 'preview',
  status text NOT NULL DEFAULT 'running',
  scope jsonb NOT NULL DEFAULT '{}'::jsonb,
  stats jsonb,
  error text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.ratenplan_generated_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES public.ratenplan_invoice_runs(id) ON DELETE SET NULL,
  profile_id uuid NOT NULL REFERENCES public.zoho_recurring_profiles(id) ON DELETE CASCADE,
  reference_number text,
  customer_name text,
  installment_no integer NOT NULL,
  installment_total integer,
  invoice_date date NOT NULL,
  due_date date,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  status text NOT NULL DEFAULT 'offen',
  origin text NOT NULL DEFAULT 'auto',
  delivery_date date,
  accounting_region public.accounting_region NOT NULL DEFAULT 'EU',
  tenant_id uuid,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ratenplan_generated_invoice
  ON public.ratenplan_generated_invoices (profile_id, invoice_date);
CREATE INDEX IF NOT EXISTS idx_ratenplan_generated_profile
  ON public.ratenplan_generated_invoices (profile_id, installment_no);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ratenplan_invoice_runs TO authenticated;
GRANT ALL ON public.ratenplan_invoice_runs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ratenplan_generated_invoices TO authenticated;
GRANT ALL ON public.ratenplan_generated_invoices TO service_role;

ALTER TABLE public.ratenplan_invoice_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ratenplan_generated_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "finance read invoice runs" ON public.ratenplan_invoice_runs
  FOR SELECT TO authenticated USING (public.can_access_finance());
CREATE POLICY "finance insert invoice runs" ON public.ratenplan_invoice_runs
  FOR INSERT TO authenticated WITH CHECK (public.can_access_finance());
CREATE POLICY "admin update invoice runs" ON public.ratenplan_invoice_runs
  FOR UPDATE TO authenticated USING (public.has_role('Admin') OR public.has_role('Super Admin'));
CREATE POLICY "superadmin delete invoice runs" ON public.ratenplan_invoice_runs
  FOR DELETE TO authenticated USING (public.has_role('Super Admin'));

CREATE POLICY "finance read generated invoices" ON public.ratenplan_generated_invoices
  FOR SELECT TO authenticated USING (public.can_access_finance());
CREATE POLICY "finance insert generated invoices" ON public.ratenplan_generated_invoices
  FOR INSERT TO authenticated WITH CHECK (public.can_access_finance());
CREATE POLICY "admin update generated invoices" ON public.ratenplan_generated_invoices
  FOR UPDATE TO authenticated USING (public.has_role('Admin') OR public.has_role('Super Admin'));
CREATE POLICY "superadmin delete generated invoices" ON public.ratenplan_generated_invoices
  FOR DELETE TO authenticated USING (public.has_role('Super Admin'));

CREATE TRIGGER trg_ratenplan_generated_invoices_updated
  BEFORE UPDATE ON public.ratenplan_generated_invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();