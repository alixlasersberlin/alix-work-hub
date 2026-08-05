-- 1) Zahlungsavis pro Kunde und pro Abo
ALTER TABLE public.cmr_customer_dunning
  ADD COLUMN IF NOT EXISTS advance_notice_active boolean,
  ADD COLUMN IF NOT EXISTS advance_notice_days integer;

ALTER TABLE public.cmr_recurring_plans
  ADD COLUMN IF NOT EXISTS advance_notice_active boolean,
  ADD COLUMN IF NOT EXISTS advance_notice_days integer;

-- 2) Sammelabrechnungspläne (ohne Abo, aus Projektzeiten)
CREATE TABLE IF NOT EXISTS public.cmr_collective_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  name text NOT NULL,
  customer_id uuid,
  customer_name text,
  customer_email text,
  project_ids uuid[] NOT NULL DEFAULT '{}',
  interval_unit text NOT NULL DEFAULT 'monat',
  next_run_date date NOT NULL DEFAULT (now()::date),
  currency text NOT NULL DEFAULT 'AED',
  tax_rate numeric NOT NULL DEFAULT 0,
  min_amount numeric NOT NULL DEFAULT 0,
  auto_send boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cmr_collective_plans TO authenticated;
GRANT ALL ON public.cmr_collective_plans TO service_role;
ALTER TABLE public.cmr_collective_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cmr_collective_plans_read" ON public.cmr_collective_plans
  FOR SELECT TO authenticated USING (public.cmr_can_write() OR public.has_role('CMR Viewer'));
CREATE POLICY "cmr_collective_plans_write" ON public.cmr_collective_plans
  FOR ALL TO authenticated USING (public.cmr_can_write()) WITH CHECK (public.cmr_can_write());

-- 3) Bankauszüge und Bankbuchungen
CREATE TABLE IF NOT EXISTS public.cmr_bank_statements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  file_name text,
  format text,
  statement_date date,
  line_count integer NOT NULL DEFAULT 0,
  matched_count integer NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  currency text,
  imported_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cmr_bank_statements TO authenticated;
GRANT ALL ON public.cmr_bank_statements TO service_role;
ALTER TABLE public.cmr_bank_statements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cmr_bank_statements_read" ON public.cmr_bank_statements
  FOR SELECT TO authenticated USING (public.cmr_can_write() OR public.has_role('CMR Viewer'));
CREATE POLICY "cmr_bank_statements_write" ON public.cmr_bank_statements
  FOR ALL TO authenticated USING (public.cmr_can_write()) WITH CHECK (public.cmr_can_write());

CREATE TABLE IF NOT EXISTS public.cmr_bank_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  statement_id uuid REFERENCES public.cmr_bank_statements(id) ON DELETE CASCADE,
  booking_date date,
  amount numeric NOT NULL DEFAULT 0,
  currency text,
  counterparty text,
  purpose text,
  reference text,
  status text NOT NULL DEFAULT 'offen',
  matched_document_id uuid,
  payment_id uuid,
  match_score numeric,
  matched_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cmr_bank_lines_tenant_status ON public.cmr_bank_lines(tenant_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cmr_bank_lines TO authenticated;
GRANT ALL ON public.cmr_bank_lines TO service_role;
ALTER TABLE public.cmr_bank_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cmr_bank_lines_read" ON public.cmr_bank_lines
  FOR SELECT TO authenticated USING (public.cmr_can_write() OR public.has_role('CMR Viewer'));
CREATE POLICY "cmr_bank_lines_write" ON public.cmr_bank_lines
  FOR ALL TO authenticated USING (public.cmr_can_write()) WITH CHECK (public.cmr_can_write());

-- 4) Kundenportal-Zugänge
CREATE TABLE IF NOT EXISTS public.cmr_portal_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  customer_id uuid,
  customer_name text,
  customer_email text,
  token text NOT NULL UNIQUE,
  expires_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  last_access_at timestamptz,
  access_count integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cmr_portal_tokens TO authenticated;
GRANT ALL ON public.cmr_portal_tokens TO service_role;
ALTER TABLE public.cmr_portal_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cmr_portal_tokens_read" ON public.cmr_portal_tokens
  FOR SELECT TO authenticated USING (public.cmr_can_write() OR public.has_role('CMR Viewer'));
CREATE POLICY "cmr_portal_tokens_write" ON public.cmr_portal_tokens
  FOR ALL TO authenticated USING (public.cmr_can_write()) WITH CHECK (public.cmr_can_write());

-- Zeitstempel-Trigger
CREATE TRIGGER trg_cmr_collective_plans_updated BEFORE UPDATE ON public.cmr_collective_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_cmr_bank_statements_updated BEFORE UPDATE ON public.cmr_bank_statements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_cmr_bank_lines_updated BEFORE UPDATE ON public.cmr_bank_lines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_cmr_portal_tokens_updated BEFORE UPDATE ON public.cmr_portal_tokens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();