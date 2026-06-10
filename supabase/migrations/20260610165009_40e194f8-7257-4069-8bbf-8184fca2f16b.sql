
-- =====================================================
-- Phase 14: Treasury + P2P + Meldewesen
-- =====================================================

-- ---------- TREASURY ----------
CREATE TABLE public.finance_bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  account_name text NOT NULL,
  bank_name text,
  iban text,
  bic text,
  currency text NOT NULL DEFAULT 'EUR',
  current_balance numeric(18,2) DEFAULT 0,
  available_balance numeric(18,2) DEFAULT 0,
  last_synced_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_bank_accounts TO authenticated;
GRANT ALL ON public.finance_bank_accounts TO service_role;
ALTER TABLE public.finance_bank_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY fba_select ON public.finance_bank_accounts FOR SELECT TO authenticated
  USING (public.is_admin() OR public.can_access_finance() OR public.has_role('Geschäftsführung'));
CREATE POLICY fba_insert ON public.finance_bank_accounts FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.can_access_finance() OR public.has_role('Geschäftsführung'));
CREATE POLICY fba_update ON public.finance_bank_accounts FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.can_access_finance() OR public.has_role('Geschäftsführung'));
CREATE POLICY fba_delete ON public.finance_bank_accounts FOR DELETE TO authenticated
  USING (public.has_role('Super Admin'));
CREATE TRIGGER trg_fba_updated BEFORE UPDATE ON public.finance_bank_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.finance_liquidity_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  bank_account_id uuid REFERENCES public.finance_bank_accounts(id) ON DELETE CASCADE,
  entry_date date NOT NULL,
  opening_balance numeric(18,2) DEFAULT 0,
  expected_inflow numeric(18,2) DEFAULT 0,
  expected_outflow numeric(18,2) DEFAULT 0,
  closing_balance numeric(18,2) DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bank_account_id, entry_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_liquidity_entries TO authenticated;
GRANT ALL ON public.finance_liquidity_entries TO service_role;
ALTER TABLE public.finance_liquidity_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY fle_select ON public.finance_liquidity_entries FOR SELECT TO authenticated
  USING (public.is_admin() OR public.can_access_finance() OR public.has_role('Geschäftsführung'));
CREATE POLICY fle_insert ON public.finance_liquidity_entries FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.can_access_finance() OR public.has_role('Geschäftsführung'));
CREATE POLICY fle_update ON public.finance_liquidity_entries FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.can_access_finance() OR public.has_role('Geschäftsführung'));
CREATE POLICY fle_delete ON public.finance_liquidity_entries FOR DELETE TO authenticated
  USING (public.has_role('Super Admin'));
CREATE TRIGGER trg_fle_updated BEFORE UPDATE ON public.finance_liquidity_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.finance_payment_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  bank_account_id uuid REFERENCES public.finance_bank_accounts(id) ON DELETE SET NULL,
  payee_name text NOT NULL,
  payee_iban text,
  amount numeric(18,2) NOT NULL,
  currency text NOT NULL DEFAULT 'EUR',
  purpose text,
  reference text,
  due_date date,
  status text NOT NULL DEFAULT 'pending', -- pending|approved|rejected|paid
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  rejection_reason text,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_payment_approvals TO authenticated;
GRANT ALL ON public.finance_payment_approvals TO service_role;
ALTER TABLE public.finance_payment_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY fpa_select ON public.finance_payment_approvals FOR SELECT TO authenticated
  USING (public.is_admin() OR public.can_access_finance() OR public.has_role('Geschäftsführung'));
CREATE POLICY fpa_insert ON public.finance_payment_approvals FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.can_access_finance() OR public.has_role('Geschäftsführung'));
CREATE POLICY fpa_update ON public.finance_payment_approvals FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.can_access_finance() OR public.has_role('Geschäftsführung'));
CREATE POLICY fpa_delete ON public.finance_payment_approvals FOR DELETE TO authenticated
  USING (public.has_role('Super Admin'));
CREATE TRIGGER trg_fpa_updated BEFORE UPDATE ON public.finance_payment_approvals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- PROCURE-TO-PAY ----------
CREATE SEQUENCE IF NOT EXISTS public.finance_pr_seq START 1;
CREATE SEQUENCE IF NOT EXISTS public.finance_po_seq START 1;

CREATE TABLE public.finance_purchase_requisitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requisition_number text UNIQUE,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  requester_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft', -- draft|submitted|approved|rejected|ordered
  total_amount numeric(18,2) DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  needed_by date,
  notes text,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_purchase_requisitions TO authenticated;
GRANT ALL ON public.finance_purchase_requisitions TO service_role;
ALTER TABLE public.finance_purchase_requisitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY fpr_select ON public.finance_purchase_requisitions FOR SELECT TO authenticated
  USING (public.is_admin() OR public.can_access_finance() OR public.has_role('Geschäftsführung'));
CREATE POLICY fpr_insert ON public.finance_purchase_requisitions FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.can_access_finance() OR public.has_role('Geschäftsführung'));
CREATE POLICY fpr_update ON public.finance_purchase_requisitions FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.can_access_finance() OR public.has_role('Geschäftsführung'));
CREATE POLICY fpr_delete ON public.finance_purchase_requisitions FOR DELETE TO authenticated
  USING (public.has_role('Super Admin'));
CREATE TRIGGER trg_fpr_updated BEFORE UPDATE ON public.finance_purchase_requisitions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.assign_pr_number()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.requisition_number IS NULL OR length(trim(NEW.requisition_number))=0 THEN
    NEW.requisition_number := 'PR-' || to_char(now(),'YYYY') || '-' || lpad(nextval('public.finance_pr_seq')::text,5,'0');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_fpr_number BEFORE INSERT ON public.finance_purchase_requisitions
  FOR EACH ROW EXECUTE FUNCTION public.assign_pr_number();

CREATE TABLE public.finance_purchase_requisition_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requisition_id uuid NOT NULL REFERENCES public.finance_purchase_requisitions(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity numeric(18,4) NOT NULL DEFAULT 1,
  unit_price numeric(18,4) NOT NULL DEFAULT 0,
  total_amount numeric(18,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  account_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_purchase_requisition_items TO authenticated;
GRANT ALL ON public.finance_purchase_requisition_items TO service_role;
ALTER TABLE public.finance_purchase_requisition_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY fpri_select ON public.finance_purchase_requisition_items FOR SELECT TO authenticated
  USING (public.is_admin() OR public.can_access_finance() OR public.has_role('Geschäftsführung'));
CREATE POLICY fpri_insert ON public.finance_purchase_requisition_items FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.can_access_finance() OR public.has_role('Geschäftsführung'));
CREATE POLICY fpri_update ON public.finance_purchase_requisition_items FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.can_access_finance() OR public.has_role('Geschäftsführung'));
CREATE POLICY fpri_delete ON public.finance_purchase_requisition_items FOR DELETE TO authenticated
  USING (public.has_role('Super Admin'));

CREATE TABLE public.finance_purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number text UNIQUE,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  requisition_id uuid REFERENCES public.finance_purchase_requisitions(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'open', -- open|partially_received|received|invoiced|closed|cancelled
  total_amount numeric(18,2) DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  ordered_at date,
  expected_delivery date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_purchase_orders TO authenticated;
GRANT ALL ON public.finance_purchase_orders TO service_role;
ALTER TABLE public.finance_purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY fpo_select ON public.finance_purchase_orders FOR SELECT TO authenticated
  USING (public.is_admin() OR public.can_access_finance() OR public.has_role('Geschäftsführung'));
CREATE POLICY fpo_insert ON public.finance_purchase_orders FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.can_access_finance() OR public.has_role('Geschäftsführung'));
CREATE POLICY fpo_update ON public.finance_purchase_orders FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.can_access_finance() OR public.has_role('Geschäftsführung'));
CREATE POLICY fpo_delete ON public.finance_purchase_orders FOR DELETE TO authenticated
  USING (public.has_role('Super Admin'));
CREATE TRIGGER trg_fpo_updated BEFORE UPDATE ON public.finance_purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.assign_po_number()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.po_number IS NULL OR length(trim(NEW.po_number))=0 THEN
    NEW.po_number := 'PO-' || to_char(now(),'YYYY') || '-' || lpad(nextval('public.finance_po_seq')::text,5,'0');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_fpo_number BEFORE INSERT ON public.finance_purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.assign_po_number();

CREATE TABLE public.finance_purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id uuid NOT NULL REFERENCES public.finance_purchase_orders(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity numeric(18,4) NOT NULL DEFAULT 1,
  unit_price numeric(18,4) NOT NULL DEFAULT 0,
  received_quantity numeric(18,4) NOT NULL DEFAULT 0,
  total_amount numeric(18,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  account_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_purchase_order_items TO authenticated;
GRANT ALL ON public.finance_purchase_order_items TO service_role;
ALTER TABLE public.finance_purchase_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY fpoi_select ON public.finance_purchase_order_items FOR SELECT TO authenticated
  USING (public.is_admin() OR public.can_access_finance() OR public.has_role('Geschäftsführung'));
CREATE POLICY fpoi_insert ON public.finance_purchase_order_items FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.can_access_finance() OR public.has_role('Geschäftsführung'));
CREATE POLICY fpoi_update ON public.finance_purchase_order_items FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.can_access_finance() OR public.has_role('Geschäftsführung'));
CREATE POLICY fpoi_delete ON public.finance_purchase_order_items FOR DELETE TO authenticated
  USING (public.has_role('Super Admin'));

CREATE TABLE public.finance_goods_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id uuid NOT NULL REFERENCES public.finance_purchase_orders(id) ON DELETE CASCADE,
  po_item_id uuid REFERENCES public.finance_purchase_order_items(id) ON DELETE SET NULL,
  received_at date NOT NULL DEFAULT current_date,
  received_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  quantity numeric(18,4) NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_goods_receipts TO authenticated;
GRANT ALL ON public.finance_goods_receipts TO service_role;
ALTER TABLE public.finance_goods_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY fgr_select ON public.finance_goods_receipts FOR SELECT TO authenticated
  USING (public.is_admin() OR public.can_access_finance() OR public.has_role('Geschäftsführung'));
CREATE POLICY fgr_insert ON public.finance_goods_receipts FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.can_access_finance() OR public.has_role('Geschäftsführung'));
CREATE POLICY fgr_update ON public.finance_goods_receipts FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.can_access_finance() OR public.has_role('Geschäftsführung'));
CREATE POLICY fgr_delete ON public.finance_goods_receipts FOR DELETE TO authenticated
  USING (public.has_role('Super Admin'));

CREATE TABLE public.finance_three_way_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id uuid REFERENCES public.finance_purchase_orders(id) ON DELETE CASCADE,
  invoice_id uuid REFERENCES public.finance_incoming_invoices(id) ON DELETE SET NULL,
  match_status text NOT NULL DEFAULT 'pending', -- pending|matched|variance|rejected
  po_amount numeric(18,2) DEFAULT 0,
  received_amount numeric(18,2) DEFAULT 0,
  invoiced_amount numeric(18,2) DEFAULT 0,
  variance_amount numeric(18,2) GENERATED ALWAYS AS (invoiced_amount - po_amount) STORED,
  currency text NOT NULL DEFAULT 'EUR',
  matched_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  matched_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_three_way_matches TO authenticated;
GRANT ALL ON public.finance_three_way_matches TO service_role;
ALTER TABLE public.finance_three_way_matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY f3wm_select ON public.finance_three_way_matches FOR SELECT TO authenticated
  USING (public.is_admin() OR public.can_access_finance() OR public.has_role('Geschäftsführung'));
CREATE POLICY f3wm_insert ON public.finance_three_way_matches FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.can_access_finance() OR public.has_role('Geschäftsführung'));
CREATE POLICY f3wm_update ON public.finance_three_way_matches FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.can_access_finance() OR public.has_role('Geschäftsführung'));
CREATE POLICY f3wm_delete ON public.finance_three_way_matches FOR DELETE TO authenticated
  USING (public.has_role('Super Admin'));
CREATE TRIGGER trg_f3wm_updated BEFORE UPDATE ON public.finance_three_way_matches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- STEUER & MELDEWESEN ----------
CREATE TABLE public.finance_tax_filings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  filing_type text NOT NULL, -- ustva|zm|oss|intrastat|ebilanz
  period_year int NOT NULL,
  period_value text NOT NULL, -- '2026-Q1', '2026-03', '2026'
  status text NOT NULL DEFAULT 'draft', -- draft|prepared|submitted|accepted|rejected
  total_amount numeric(18,2) DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  payload jsonb,
  export_format text,
  export_content text,
  prepared_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  prepared_at timestamptz,
  submitted_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, filing_type, period_value)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_tax_filings TO authenticated;
GRANT ALL ON public.finance_tax_filings TO service_role;
ALTER TABLE public.finance_tax_filings ENABLE ROW LEVEL SECURITY;
CREATE POLICY ftf_select ON public.finance_tax_filings FOR SELECT TO authenticated
  USING (public.is_admin() OR public.can_access_finance() OR public.has_role('Geschäftsführung'));
CREATE POLICY ftf_insert ON public.finance_tax_filings FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.can_access_finance() OR public.has_role('Geschäftsführung'));
CREATE POLICY ftf_update ON public.finance_tax_filings FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.can_access_finance() OR public.has_role('Geschäftsführung'));
CREATE POLICY ftf_delete ON public.finance_tax_filings FOR DELETE TO authenticated
  USING (public.has_role('Super Admin'));
CREATE TRIGGER trg_ftf_updated BEFORE UPDATE ON public.finance_tax_filings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.finance_tax_filing_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filing_id uuid NOT NULL REFERENCES public.finance_tax_filings(id) ON DELETE CASCADE,
  line_code text NOT NULL,
  line_label text,
  amount numeric(18,2) NOT NULL DEFAULT 0,
  base_amount numeric(18,2),
  tax_rate numeric(6,3),
  country_code text,
  vat_id text,
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_tax_filing_lines TO authenticated;
GRANT ALL ON public.finance_tax_filing_lines TO service_role;
ALTER TABLE public.finance_tax_filing_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY ftfl_select ON public.finance_tax_filing_lines FOR SELECT TO authenticated
  USING (public.is_admin() OR public.can_access_finance() OR public.has_role('Geschäftsführung'));
CREATE POLICY ftfl_insert ON public.finance_tax_filing_lines FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.can_access_finance() OR public.has_role('Geschäftsführung'));
CREATE POLICY ftfl_update ON public.finance_tax_filing_lines FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.can_access_finance() OR public.has_role('Geschäftsführung'));
CREATE POLICY ftfl_delete ON public.finance_tax_filing_lines FOR DELETE TO authenticated
  USING (public.has_role('Super Admin'));

CREATE INDEX idx_fle_account_date ON public.finance_liquidity_entries(bank_account_id, entry_date DESC);
CREATE INDEX idx_fpa_status ON public.finance_payment_approvals(status, created_at DESC);
CREATE INDEX idx_fpo_status ON public.finance_purchase_orders(status, created_at DESC);
CREATE INDEX idx_fgr_po ON public.finance_goods_receipts(po_id);
CREATE INDEX idx_ftf_tenant_period ON public.finance_tax_filings(tenant_id, period_year DESC);
