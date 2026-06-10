
CREATE TABLE IF NOT EXISTS public.finance_bank_statements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  iban text,
  account_name text,
  format text NOT NULL,
  filename text,
  period_from date,
  period_to date,
  opening_balance numeric(14,2),
  closing_balance numeric(14,2),
  currency text DEFAULT 'EUR',
  line_count integer NOT NULL DEFAULT 0,
  matched_count integer NOT NULL DEFAULT 0,
  file_hash text UNIQUE,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_bank_statements TO authenticated;
GRANT ALL ON public.finance_bank_statements TO service_role;
ALTER TABLE public.finance_bank_statements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fbs_select" ON public.finance_bank_statements;
CREATE POLICY "fbs_select" ON public.finance_bank_statements FOR SELECT TO authenticated USING (public.can_view_finance_module());
DROP POLICY IF EXISTS "fbs_insert" ON public.finance_bank_statements;
CREATE POLICY "fbs_insert" ON public.finance_bank_statements FOR INSERT TO authenticated WITH CHECK (public.can_access_finance_module());
DROP POLICY IF EXISTS "fbs_update" ON public.finance_bank_statements;
CREATE POLICY "fbs_update" ON public.finance_bank_statements FOR UPDATE TO authenticated USING (public.can_access_finance_module()) WITH CHECK (public.can_access_finance_module());
DROP POLICY IF EXISTS "fbs_delete" ON public.finance_bank_statements;
CREATE POLICY "fbs_delete" ON public.finance_bank_statements FOR DELETE TO authenticated USING (public.has_role('Super Admin'));

CREATE TABLE IF NOT EXISTS public.finance_bank_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  statement_id uuid NOT NULL REFERENCES public.finance_bank_statements(id) ON DELETE CASCADE,
  booking_date date,
  value_date date,
  amount numeric(14,2) NOT NULL,
  currency text DEFAULT 'EUR',
  purpose text,
  counterparty_name text,
  counterparty_iban text,
  end_to_end_id text,
  status text NOT NULL DEFAULT 'offen',
  matched_transaction_id uuid REFERENCES public.finance_transactions(id) ON DELETE SET NULL,
  matched_customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  match_confidence numeric(4,2),
  match_method text,
  matched_at timestamptz,
  matched_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  line_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fbl_statement ON public.finance_bank_lines(statement_id);
CREATE INDEX IF NOT EXISTS idx_fbl_status ON public.finance_bank_lines(status);
CREATE INDEX IF NOT EXISTS idx_fbl_booking_date ON public.finance_bank_lines(booking_date);
CREATE UNIQUE INDEX IF NOT EXISTS uq_fbl_hash ON public.finance_bank_lines(statement_id, line_hash) WHERE line_hash IS NOT NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_bank_lines TO authenticated;
GRANT ALL ON public.finance_bank_lines TO service_role;
ALTER TABLE public.finance_bank_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fbl_select" ON public.finance_bank_lines;
CREATE POLICY "fbl_select" ON public.finance_bank_lines FOR SELECT TO authenticated USING (public.can_view_finance_module());
DROP POLICY IF EXISTS "fbl_insert" ON public.finance_bank_lines;
CREATE POLICY "fbl_insert" ON public.finance_bank_lines FOR INSERT TO authenticated WITH CHECK (public.can_access_finance_module());
DROP POLICY IF EXISTS "fbl_update" ON public.finance_bank_lines;
CREATE POLICY "fbl_update" ON public.finance_bank_lines FOR UPDATE TO authenticated USING (public.can_access_finance_module()) WITH CHECK (public.can_access_finance_module());
DROP POLICY IF EXISTS "fbl_delete" ON public.finance_bank_lines;
CREATE POLICY "fbl_delete" ON public.finance_bank_lines FOR DELETE TO authenticated USING (public.has_role('Super Admin'));

DROP TRIGGER IF EXISTS trg_fbl_updated_at ON public.finance_bank_lines;
CREATE TRIGGER trg_fbl_updated_at BEFORE UPDATE ON public.finance_bank_lines
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
