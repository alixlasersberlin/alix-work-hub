
CREATE TABLE public.bank_return_debits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  company_id text,
  accounting_area text NOT NULL DEFAULT 'EU',
  bank_account_id uuid REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  bank_transaction_id uuid NOT NULL REFERENCES public.bank_transactions(id) ON DELETE CASCADE,
  original_payment_transaction_id uuid REFERENCES public.bank_transactions(id) ON DELETE SET NULL,
  customer_id uuid,
  invoice_id text,
  invoice_number text,
  order_id uuid,
  installment_id text,
  return_debit_amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  bank_fee numeric NOT NULL DEFAULT 0,
  customer_fee numeric NOT NULL DEFAULT 0,
  additional_costs numeric NOT NULL DEFAULT 0,
  charge_customer boolean NOT NULL DEFAULT false,
  fee_handling text NOT NULL DEFAULT 'intern',
  cost_center text,
  booking_account text,
  return_reason text,
  return_code text,
  booking_date date,
  value_date date,
  matching_score integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'erkannt',
  note text,
  sepa_mandate_blocked boolean NOT NULL DEFAULT false,
  reminder_process_started boolean NOT NULL DEFAULT false,
  reversal_of uuid REFERENCES public.bank_return_debits(id) ON DELETE SET NULL,
  created_by uuid,
  confirmed_by uuid,
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_return_debits TO authenticated;
GRANT ALL ON public.bank_return_debits TO service_role;
ALTER TABLE public.bank_return_debits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rd_select_admin" ON public.bank_return_debits FOR SELECT TO authenticated
  USING (public.has_role('Admin') OR public.has_role('Super Admin'));
CREATE POLICY "rd_insert_admin" ON public.bank_return_debits FOR INSERT TO authenticated
  WITH CHECK (public.has_role('Admin') OR public.has_role('Super Admin'));
CREATE POLICY "rd_update_admin" ON public.bank_return_debits FOR UPDATE TO authenticated
  USING (public.has_role('Admin') OR public.has_role('Super Admin'))
  WITH CHECK (public.has_role('Admin') OR public.has_role('Super Admin'));
CREATE POLICY "rd_delete_superadmin" ON public.bank_return_debits FOR DELETE TO authenticated
  USING (public.has_role('Super Admin'));

CREATE TABLE public.bank_return_debit_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_debit_id uuid NOT NULL REFERENCES public.bank_return_debits(id) ON DELETE CASCADE,
  invoice_id text,
  invoice_number text,
  invoice_source text NOT NULL DEFAULT 'invoice',
  installment_id text,
  order_id uuid,
  original_payment_allocation_id uuid REFERENCES public.bank_transaction_allocations(id) ON DELETE SET NULL,
  allocated_amount numeric NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_return_debit_allocations TO authenticated;
GRANT ALL ON public.bank_return_debit_allocations TO service_role;
ALTER TABLE public.bank_return_debit_allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rda_select_admin" ON public.bank_return_debit_allocations FOR SELECT TO authenticated
  USING (public.has_role('Admin') OR public.has_role('Super Admin'));
CREATE POLICY "rda_insert_admin" ON public.bank_return_debit_allocations FOR INSERT TO authenticated
  WITH CHECK (public.has_role('Admin') OR public.has_role('Super Admin'));
CREATE POLICY "rda_update_admin" ON public.bank_return_debit_allocations FOR UPDATE TO authenticated
  USING (public.has_role('Admin') OR public.has_role('Super Admin'))
  WITH CHECK (public.has_role('Admin') OR public.has_role('Super Admin'));
CREATE POLICY "rda_delete_superadmin" ON public.bank_return_debit_allocations FOR DELETE TO authenticated
  USING (public.has_role('Super Admin'));

CREATE TABLE public.payment_risk_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  company_id text,
  customer_id uuid NOT NULL,
  risk_type text NOT NULL DEFAULT 'lastschrift_gesperrt',
  risk_level text NOT NULL DEFAULT 'mittel',
  active boolean NOT NULL DEFAULT true,
  reason text,
  related_return_debit_id uuid REFERENCES public.bank_return_debits(id) ON DELETE SET NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_by uuid,
  resolved_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_risk_flags TO authenticated;
GRANT ALL ON public.payment_risk_flags TO service_role;
ALTER TABLE public.payment_risk_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prf_select_auth" ON public.payment_risk_flags FOR SELECT TO authenticated USING (true);
CREATE POLICY "prf_insert_admin" ON public.payment_risk_flags FOR INSERT TO authenticated
  WITH CHECK (public.has_role('Admin') OR public.has_role('Super Admin'));
CREATE POLICY "prf_update_admin" ON public.payment_risk_flags FOR UPDATE TO authenticated
  USING (public.has_role('Admin') OR public.has_role('Super Admin'))
  WITH CHECK (public.has_role('Admin') OR public.has_role('Super Admin'));
CREATE POLICY "prf_delete_superadmin" ON public.payment_risk_flags FOR DELETE TO authenticated
  USING (public.has_role('Super Admin'));

CREATE INDEX idx_brd_tx ON public.bank_return_debits(bank_transaction_id);
CREATE INDEX idx_brd_customer ON public.bank_return_debits(customer_id);
CREATE INDEX idx_brd_status ON public.bank_return_debits(status);
CREATE INDEX idx_brda_rd ON public.bank_return_debit_allocations(return_debit_id);
CREATE INDEX idx_prf_customer ON public.payment_risk_flags(customer_id) WHERE active;

CREATE TRIGGER trg_brd_updated BEFORE UPDATE ON public.bank_return_debits
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
