
-- ============ bank_accounts ============
CREATE TABLE public.bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  company_id text,
  accounting_area text NOT NULL DEFAULT 'EU',
  bank_name text NOT NULL,
  account_name text NOT NULL,
  iban text,
  bic text,
  currency text NOT NULL DEFAULT 'EUR',
  country text,
  automatic_booking_enabled boolean NOT NULL DEFAULT false,
  auto_book_threshold integer NOT NULL DEFAULT 95,
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_accounts TO authenticated;
GRANT ALL ON public.bank_accounts TO service_role;
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bank_accounts_read" ON public.bank_accounts FOR SELECT TO authenticated
  USING (public.has_role('Admin') OR public.has_role('Super Admin'));
CREATE POLICY "bank_accounts_write" ON public.bank_accounts FOR INSERT TO authenticated
  WITH CHECK (public.has_role('Admin') OR public.has_role('Super Admin'));
CREATE POLICY "bank_accounts_update" ON public.bank_accounts FOR UPDATE TO authenticated
  USING (public.has_role('Admin') OR public.has_role('Super Admin'))
  WITH CHECK (public.has_role('Admin') OR public.has_role('Super Admin'));
CREATE POLICY "bank_accounts_delete" ON public.bank_accounts FOR DELETE TO authenticated
  USING (public.has_role('Super Admin'));

-- ============ bank_imports ============
CREATE TABLE public.bank_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  company_id text,
  accounting_area text NOT NULL DEFAULT 'EU',
  bank_account_id uuid REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  import_number text,
  file_name text NOT NULL,
  file_format text NOT NULL,
  file_path text,
  file_hash text,
  period_from date,
  period_to date,
  total_transactions integer NOT NULL DEFAULT 0,
  total_income numeric NOT NULL DEFAULT 0,
  total_expenses numeric NOT NULL DEFAULT 0,
  duplicates_count integer NOT NULL DEFAULT 0,
  auto_matched_count integer NOT NULL DEFAULT 0,
  manual_matched_count integer NOT NULL DEFAULT 0,
  unmatched_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'importiert',
  error_log jsonb,
  imported_by uuid,
  imported_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_imports TO authenticated;
GRANT ALL ON public.bank_imports TO service_role;
ALTER TABLE public.bank_imports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bank_imports_read" ON public.bank_imports FOR SELECT TO authenticated
  USING (public.has_role('Admin') OR public.has_role('Super Admin'));
CREATE POLICY "bank_imports_insert" ON public.bank_imports FOR INSERT TO authenticated
  WITH CHECK (public.has_role('Admin') OR public.has_role('Super Admin'));
CREATE POLICY "bank_imports_update" ON public.bank_imports FOR UPDATE TO authenticated
  USING (public.has_role('Admin') OR public.has_role('Super Admin'))
  WITH CHECK (public.has_role('Admin') OR public.has_role('Super Admin'));
CREATE POLICY "bank_imports_delete" ON public.bank_imports FOR DELETE TO authenticated
  USING (public.has_role('Super Admin'));

-- ============ bank_transactions ============
CREATE TABLE public.bank_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  company_id text,
  accounting_area text NOT NULL DEFAULT 'EU',
  bank_account_id uuid REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  bank_import_id uuid REFERENCES public.bank_imports(id) ON DELETE SET NULL,
  booking_date date,
  value_date date,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  transaction_type text NOT NULL DEFAULT 'eingang',
  sender_receiver_name text,
  sender_receiver_iban text,
  bic text,
  booking_text text,
  purpose text,
  bank_reference text,
  end_to_end_reference text,
  mandate_reference text,
  customer_reference text,
  invoice_number_hint text,
  raw_data jsonb,
  duplicate_hash text,
  is_duplicate boolean NOT NULL DEFAULT false,
  duplicate_of uuid,
  status text NOT NULL DEFAULT 'offen',
  matching_score integer NOT NULL DEFAULT 0,
  matched_customer_id uuid,
  matched_invoice_id text,
  is_return_debit boolean NOT NULL DEFAULT false,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_transactions TO authenticated;
GRANT ALL ON public.bank_transactions TO service_role;
ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bank_tx_read" ON public.bank_transactions FOR SELECT TO authenticated
  USING (public.has_role('Admin') OR public.has_role('Super Admin'));
CREATE POLICY "bank_tx_insert" ON public.bank_transactions FOR INSERT TO authenticated
  WITH CHECK (public.has_role('Admin') OR public.has_role('Super Admin'));
CREATE POLICY "bank_tx_update" ON public.bank_transactions FOR UPDATE TO authenticated
  USING (public.has_role('Admin') OR public.has_role('Super Admin'))
  WITH CHECK (public.has_role('Admin') OR public.has_role('Super Admin'));
CREATE POLICY "bank_tx_delete" ON public.bank_transactions FOR DELETE TO authenticated
  USING (public.has_role('Super Admin') AND status <> 'verbucht');

CREATE INDEX idx_bank_tx_import ON public.bank_transactions(bank_import_id);
CREATE INDEX idx_bank_tx_account ON public.bank_transactions(bank_account_id);
CREATE INDEX idx_bank_tx_status ON public.bank_transactions(status);
CREATE INDEX idx_bank_tx_bdate ON public.bank_transactions(booking_date DESC);
CREATE UNIQUE INDEX uq_bank_tx_hash ON public.bank_transactions(bank_account_id, duplicate_hash) WHERE duplicate_hash IS NOT NULL AND is_duplicate = false;

-- ============ bank_transaction_matches ============
CREATE TABLE public.bank_transaction_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_transaction_id uuid NOT NULL REFERENCES public.bank_transactions(id) ON DELETE CASCADE,
  customer_id uuid,
  invoice_id text,
  invoice_number text,
  order_id uuid,
  suggested_amount numeric,
  matching_score integer NOT NULL DEFAULT 0,
  matching_reasons jsonb,
  status text NOT NULL DEFAULT 'vorschlag',
  confirmed_by uuid,
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_transaction_matches TO authenticated;
GRANT ALL ON public.bank_transaction_matches TO service_role;
ALTER TABLE public.bank_transaction_matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bank_match_read" ON public.bank_transaction_matches FOR SELECT TO authenticated
  USING (public.has_role('Admin') OR public.has_role('Super Admin'));
CREATE POLICY "bank_match_insert" ON public.bank_transaction_matches FOR INSERT TO authenticated
  WITH CHECK (public.has_role('Admin') OR public.has_role('Super Admin'));
CREATE POLICY "bank_match_update" ON public.bank_transaction_matches FOR UPDATE TO authenticated
  USING (public.has_role('Admin') OR public.has_role('Super Admin'))
  WITH CHECK (public.has_role('Admin') OR public.has_role('Super Admin'));
CREATE POLICY "bank_match_delete" ON public.bank_transaction_matches FOR DELETE TO authenticated
  USING (public.has_role('Super Admin'));
CREATE INDEX idx_bank_match_tx ON public.bank_transaction_matches(bank_transaction_id);

-- ============ bank_transaction_allocations ============
CREATE TABLE public.bank_transaction_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_transaction_id uuid NOT NULL REFERENCES public.bank_transactions(id) ON DELETE CASCADE,
  invoice_id text,
  invoice_number text,
  customer_id uuid,
  supplier_id uuid,
  order_id uuid,
  allocation_type text NOT NULL DEFAULT 'rechnung',
  allocated_amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'EUR',
  reversal_of uuid,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.bank_transaction_allocations TO authenticated;
GRANT ALL ON public.bank_transaction_allocations TO service_role;
ALTER TABLE public.bank_transaction_allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bank_alloc_read" ON public.bank_transaction_allocations FOR SELECT TO authenticated
  USING (public.has_role('Admin') OR public.has_role('Super Admin'));
CREATE POLICY "bank_alloc_insert" ON public.bank_transaction_allocations FOR INSERT TO authenticated
  WITH CHECK (public.has_role('Admin') OR public.has_role('Super Admin'));
CREATE POLICY "bank_alloc_update" ON public.bank_transaction_allocations FOR UPDATE TO authenticated
  USING (public.has_role('Super Admin'))
  WITH CHECK (public.has_role('Super Admin'));
CREATE INDEX idx_bank_alloc_tx ON public.bank_transaction_allocations(bank_transaction_id);

-- ============ bank_import_templates ============
CREATE TABLE public.bank_import_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  bank_account_id uuid REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  template_name text NOT NULL,
  file_format text NOT NULL,
  column_mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  parsing_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_import_templates TO authenticated;
GRANT ALL ON public.bank_import_templates TO service_role;
ALTER TABLE public.bank_import_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bank_tpl_read" ON public.bank_import_templates FOR SELECT TO authenticated
  USING (public.has_role('Admin') OR public.has_role('Super Admin'));
CREATE POLICY "bank_tpl_insert" ON public.bank_import_templates FOR INSERT TO authenticated
  WITH CHECK (public.has_role('Admin') OR public.has_role('Super Admin'));
CREATE POLICY "bank_tpl_update" ON public.bank_import_templates FOR UPDATE TO authenticated
  USING (public.has_role('Admin') OR public.has_role('Super Admin'))
  WITH CHECK (public.has_role('Admin') OR public.has_role('Super Admin'));
CREATE POLICY "bank_tpl_delete" ON public.bank_import_templates FOR DELETE TO authenticated
  USING (public.has_role('Super Admin'));

-- ============ bank_audit_log (immutable) ============
CREATE TABLE public.bank_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  company_id text,
  bank_transaction_id uuid,
  bank_import_id uuid,
  action text NOT NULL,
  old_value jsonb,
  new_value jsonb,
  user_id uuid,
  user_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.bank_audit_log TO authenticated;
GRANT ALL ON public.bank_audit_log TO service_role;
ALTER TABLE public.bank_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bank_audit_read" ON public.bank_audit_log FOR SELECT TO authenticated
  USING (public.has_role('Admin') OR public.has_role('Super Admin'));
CREATE POLICY "bank_audit_insert" ON public.bank_audit_log FOR INSERT TO authenticated
  WITH CHECK (public.has_role('Admin') OR public.has_role('Super Admin'));
CREATE INDEX idx_bank_audit_tx ON public.bank_audit_log(bank_transaction_id);
CREATE INDEX idx_bank_audit_import ON public.bank_audit_log(bank_import_id);

-- updated_at triggers
CREATE TRIGGER trg_bank_accounts_upd BEFORE UPDATE ON public.bank_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_bank_imports_upd BEFORE UPDATE ON public.bank_imports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_bank_tx_upd BEFORE UPDATE ON public.bank_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_bank_tpl_upd BEFORE UPDATE ON public.bank_import_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- import number sequence
CREATE SEQUENCE IF NOT EXISTS public.bank_import_number_seq START 1000;
CREATE OR REPLACE FUNCTION public.assign_bank_import_number()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.import_number IS NULL THEN
    NEW.import_number := 'BI-' || to_char(now(),'YYYY') || '-' || lpad(nextval('public.bank_import_number_seq')::text, 5, '0');
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_bank_import_number BEFORE INSERT ON public.bank_imports
  FOR EACH ROW EXECUTE FUNCTION public.assign_bank_import_number();
