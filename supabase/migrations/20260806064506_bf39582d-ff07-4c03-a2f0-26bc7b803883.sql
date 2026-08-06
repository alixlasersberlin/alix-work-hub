
-- ============ ENUMS ============
CREATE TYPE public.commission_type AS ENUM ('percent','fixed_per_device','tiered','combined','team','special');
CREATE TYPE public.commission_basis AS ENUM ('net','gross','net_after_discount','gross_after_discount','margin','paid_amount','paid_installment','custom');
CREATE TYPE public.commission_effective_event AS ENUM ('order_created','order_confirmed','withdrawal_expired','deposit_received','fully_paid','delivered','handover_confirmed','commissioned','custom_deadline','installment_received','financing_approved','admin_release','custom');
CREATE TYPE public.commission_payout_timing AS ENUM ('immediate','next_payroll','month_end','first_of_next_month','fifteenth_of_next_month','after_full_payment','after_first_installment','after_specific_installment','pro_rata_installments','after_handover','after_withdrawal_period','after_retention_period','manual_release','custom_date');
CREATE TYPE public.commission_status AS ENUM ('not_calculated','preliminary','condition_open','effective','blocked','in_review','pending_approval','approved','payout_scheduled','paid','partially_paid','corrected','cancelled','reclaimed','closed');
CREATE TYPE public.commission_employee_role AS ENUM ('verkaeufer','verkaufsberater','vertriebsmitarbeiter','teamleiter_vertrieb','vermittler','aussendienst','empfehlungsgeber','account_manager','vertriebsleiter','filialleiter','kooperationspartner','handelsvertreter','weiterer_beteiligter');
CREATE TYPE public.commission_tier_period AS ENUM ('monthly','quarterly','half_year','yearly','custom');

-- ============ HELPER ============
CREATE OR REPLACE FUNCTION public.comm_can_manage(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT public.has_role('Admin') OR public.has_role('Super Admin')
$$;

CREATE OR REPLACE FUNCTION public.comm_can_read(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT public.comm_can_manage(_uid)
      OR public.has_role('Buchhaltung EU')
      OR public.has_role('Buchhaltung CH')
      OR public.has_role('Buchhaltung Admin')
$$;

CREATE OR REPLACE FUNCTION public.comm_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ============ RULES ============
CREATE TABLE public.commission_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  location text,
  commission_group text,
  valid_from date,
  valid_to date,
  commission_type public.commission_type NOT NULL DEFAULT 'percent',
  percent_value numeric(7,4) DEFAULT 0 CHECK (percent_value >= 0 AND percent_value <= 100),
  fixed_amount numeric(14,2) DEFAULT 0 CHECK (fixed_amount >= 0),
  tiers jsonb NOT NULL DEFAULT '[]'::jsonb,
  tier_period public.commission_tier_period DEFAULT 'monthly',
  basis public.commission_basis NOT NULL DEFAULT 'net_after_discount',
  effective_event public.commission_effective_event NOT NULL DEFAULT 'delivered',
  effective_conditions jsonb NOT NULL DEFAULT '[]'::jsonb,
  payout_timing public.commission_payout_timing NOT NULL DEFAULT 'fifteenth_of_next_month',
  payout_min_wait_days integer NOT NULL DEFAULT 0,
  payout_retention_days integer NOT NULL DEFAULT 0,
  payout_min_amount numeric(14,2) NOT NULL DEFAULT 0,
  payout_workdays_only boolean NOT NULL DEFAULT false,
  payout_grouped_monthly boolean NOT NULL DEFAULT true,
  installment_mode text NOT NULL DEFAULT 'full_after_full_payment',
  installment_schedule jsonb NOT NULL DEFAULT '[]'::jsonb,
  reclaim_rule text NOT NULL DEFAULT 'full_on_cancellation',
  cancellation_rule text NOT NULL DEFAULT 'cancel_unpaid',
  min_sales_price numeric(14,2),
  max_discount_percent numeric(7,4),
  min_margin numeric(14,2),
  order_type text,
  payment_method text,
  currency text NOT NULL DEFAULT 'EUR',
  tax_treatment text,
  cost_center text,
  account_number text,
  approval_required boolean NOT NULL DEFAULT true,
  approval_limit_amount numeric(14,2),
  auto_calculate boolean NOT NULL DEFAULT true,
  auto_prepare_payout boolean NOT NULL DEFAULT false,
  internal_notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commission_rules TO authenticated;
GRANT ALL ON public.commission_rules TO service_role;
ALTER TABLE public.commission_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comm rules read" ON public.commission_rules FOR SELECT TO authenticated USING (public.comm_can_read(auth.uid()));
CREATE POLICY "comm rules insert" ON public.commission_rules FOR INSERT TO authenticated WITH CHECK (public.comm_can_manage(auth.uid()));
CREATE POLICY "comm rules update" ON public.commission_rules FOR UPDATE TO authenticated USING (public.comm_can_manage(auth.uid())) WITH CHECK (public.comm_can_manage(auth.uid()));
CREATE POLICY "comm rules delete" ON public.commission_rules FOR DELETE TO authenticated USING (public.has_role('Super Admin'));
CREATE TRIGGER trg_commission_rules_touch BEFORE UPDATE ON public.commission_rules FOR EACH ROW EXECUTE FUNCTION public.comm_touch();

CREATE TABLE public.commission_rule_employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid NOT NULL REFERENCES public.commission_rules(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  employee_role public.commission_employee_role NOT NULL DEFAULT 'verkaeufer',
  percent_override numeric(7,4) CHECK (percent_override IS NULL OR (percent_override >= 0 AND percent_override <= 100)),
  fixed_override numeric(14,2) CHECK (fixed_override IS NULL OR fixed_override >= 0),
  priority integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rule_id, employee_id, employee_role)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commission_rule_employees TO authenticated;
GRANT ALL ON public.commission_rule_employees TO service_role;
ALTER TABLE public.commission_rule_employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cre read" ON public.commission_rule_employees FOR SELECT TO authenticated USING (public.comm_can_read(auth.uid()));
CREATE POLICY "cre write" ON public.commission_rule_employees FOR ALL TO authenticated USING (public.comm_can_manage(auth.uid())) WITH CHECK (public.comm_can_manage(auth.uid()));

CREATE TABLE public.commission_rule_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid NOT NULL REFERENCES public.commission_rules(id) ON DELETE CASCADE,
  match_type text NOT NULL DEFAULT 'product_group',
  match_value text NOT NULL,
  percent_override numeric(7,4) CHECK (percent_override IS NULL OR (percent_override >= 0 AND percent_override <= 100)),
  fixed_override numeric(14,2) CHECK (fixed_override IS NULL OR fixed_override >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commission_rule_products TO authenticated;
GRANT ALL ON public.commission_rule_products TO service_role;
ALTER TABLE public.commission_rule_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crp read" ON public.commission_rule_products FOR SELECT TO authenticated USING (public.comm_can_read(auth.uid()));
CREATE POLICY "crp write" ON public.commission_rule_products FOR ALL TO authenticated USING (public.comm_can_manage(auth.uid())) WITH CHECK (public.comm_can_manage(auth.uid()));

CREATE TABLE public.commission_rule_mandants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid NOT NULL REFERENCES public.commission_rules(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  percent_override numeric(7,4) CHECK (percent_override IS NULL OR (percent_override >= 0 AND percent_override <= 100)),
  cost_center text,
  account_number text,
  currency text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rule_id, tenant_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commission_rule_mandants TO authenticated;
GRANT ALL ON public.commission_rule_mandants TO service_role;
ALTER TABLE public.commission_rule_mandants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm read" ON public.commission_rule_mandants FOR SELECT TO authenticated USING (public.comm_can_read(auth.uid()));
CREATE POLICY "crm write" ON public.commission_rule_mandants FOR ALL TO authenticated USING (public.comm_can_manage(auth.uid())) WITH CHECK (public.comm_can_manage(auth.uid()));

-- ============ EMPLOYEE MASTER DATA ============
CREATE TABLE public.commission_employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL UNIQUE REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  personnel_number text,
  department text,
  employment_type text,
  hire_date date,
  exit_date date,
  commission_active boolean NOT NULL DEFAULT true,
  default_rule_id uuid REFERENCES public.commission_rules(id) ON DELETE SET NULL,
  individual_percent numeric(7,4) CHECK (individual_percent IS NULL OR (individual_percent >= 0 AND individual_percent <= 100)),
  individual_fixed numeric(14,2),
  payout_method text,
  bank_iban text,
  bank_name text,
  tax_treatment text,
  cost_center text,
  account_number text,
  supervisor_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  commission_group text,
  contract_start date,
  contract_end date,
  internal_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commission_employees TO authenticated;
GRANT ALL ON public.commission_employees TO service_role;
ALTER TABLE public.commission_employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ce read" ON public.commission_employees FOR SELECT TO authenticated USING (public.comm_can_read(auth.uid()) OR employee_id = auth.uid());
CREATE POLICY "ce write" ON public.commission_employees FOR ALL TO authenticated USING (public.comm_can_manage(auth.uid())) WITH CHECK (public.comm_can_manage(auth.uid()));
CREATE TRIGGER trg_commission_employees_touch BEFORE UPDATE ON public.commission_employees FOR EACH ROW EXECUTE FUNCTION public.comm_touch();

-- ============ ASSIGNMENTS ============
CREATE TABLE public.commission_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  employee_role public.commission_employee_role NOT NULL DEFAULT 'verkaeufer',
  share_percent numeric(7,4) NOT NULL DEFAULT 100 CHECK (share_percent >= 0 AND share_percent <= 100),
  fixed_share numeric(14,2),
  priority integer NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'manual',
  rule_id uuid REFERENCES public.commission_rules(id) ON DELETE SET NULL,
  note text,
  assigned_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, employee_id, employee_role)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commission_assignments TO authenticated;
GRANT ALL ON public.commission_assignments TO service_role;
ALTER TABLE public.commission_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ca read" ON public.commission_assignments FOR SELECT TO authenticated USING (public.comm_can_read(auth.uid()) OR employee_id = auth.uid());
CREATE POLICY "ca write" ON public.commission_assignments FOR ALL TO authenticated USING (public.comm_can_manage(auth.uid())) WITH CHECK (public.comm_can_manage(auth.uid()));
CREATE TRIGGER trg_commission_assignments_touch BEFORE UPDATE ON public.commission_assignments FOR EACH ROW EXECUTE FUNCTION public.comm_touch();
CREATE INDEX idx_comm_assign_order ON public.commission_assignments(order_id);
CREATE INDEX idx_comm_assign_emp ON public.commission_assignments(employee_id);

-- ============ ENTRIES ============
CREATE SEQUENCE public.commission_entry_seq;

CREATE TABLE public.commission_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_number text NOT NULL UNIQUE DEFAULT ('PRV-' || to_char(now(),'YYYY') || '-' || lpad(nextval('public.commission_entry_seq')::text, 6, '0')),
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  order_number text,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name text,
  employee_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
  employee_role public.commission_employee_role NOT NULL DEFAULT 'verkaeufer',
  rule_id uuid REFERENCES public.commission_rules(id) ON DELETE SET NULL,
  rule_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  location text,
  cost_center text,
  account_number text,
  device_name text,
  device_sku text,
  serial_number text,
  device_count integer NOT NULL DEFAULT 1,
  order_date date,
  delivery_date date,
  net_amount numeric(14,2) NOT NULL DEFAULT 0,
  gross_amount numeric(14,2) NOT NULL DEFAULT 0,
  discount_amount numeric(14,2) NOT NULL DEFAULT 0,
  basis public.commission_basis NOT NULL DEFAULT 'net_after_discount',
  basis_amount numeric(14,2) NOT NULL DEFAULT 0,
  commission_type public.commission_type NOT NULL DEFAULT 'percent',
  commission_percent numeric(7,4) NOT NULL DEFAULT 0,
  commission_amount numeric(14,2) NOT NULL DEFAULT 0,
  paid_amount numeric(14,2) NOT NULL DEFAULT 0,
  open_amount numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  customer_payment_status text,
  customer_paid_percent numeric(7,4) NOT NULL DEFAULT 0,
  effective_at date,
  payout_due_date date,
  status public.commission_status NOT NULL DEFAULT 'preliminary',
  block_reason text,
  approval_state text NOT NULL DEFAULT 'open',
  approved_by uuid,
  approved_at timestamptz,
  is_special boolean NOT NULL DEFAULT false,
  special_reason text,
  parent_entry_id uuid REFERENCES public.commission_entries(id) ON DELETE SET NULL,
  calc_hash text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commission_entries TO authenticated;
GRANT ALL ON public.commission_entries TO service_role;
ALTER TABLE public.commission_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ced read" ON public.commission_entries FOR SELECT TO authenticated
  USING (public.comm_can_read(auth.uid()) OR (employee_id = auth.uid() AND status IN ('approved','payout_scheduled','paid','partially_paid','closed')));
CREATE POLICY "ced insert" ON public.commission_entries FOR INSERT TO authenticated WITH CHECK (public.comm_can_manage(auth.uid()));
CREATE POLICY "ced update" ON public.commission_entries FOR UPDATE TO authenticated USING (public.comm_can_manage(auth.uid())) WITH CHECK (public.comm_can_manage(auth.uid()));
CREATE POLICY "ced delete" ON public.commission_entries FOR DELETE TO authenticated USING (public.has_role('Super Admin'));
CREATE TRIGGER trg_commission_entries_touch BEFORE UPDATE ON public.commission_entries FOR EACH ROW EXECUTE FUNCTION public.comm_touch();
CREATE UNIQUE INDEX uq_comm_entry_calc ON public.commission_entries(calc_hash) WHERE calc_hash IS NOT NULL;
CREATE INDEX idx_comm_entry_emp ON public.commission_entries(employee_id);
CREATE INDEX idx_comm_entry_status ON public.commission_entries(status);
CREATE INDEX idx_comm_entry_order ON public.commission_entries(order_id);
CREATE INDEX idx_comm_entry_due ON public.commission_entries(payout_due_date);

CREATE TABLE public.commission_entry_splits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid NOT NULL REFERENCES public.commission_entries(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
  employee_role public.commission_employee_role NOT NULL DEFAULT 'verkaeufer',
  share_percent numeric(7,4) NOT NULL DEFAULT 0 CHECK (share_percent >= 0 AND share_percent <= 100),
  amount numeric(14,2) NOT NULL DEFAULT 0,
  priority integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commission_entry_splits TO authenticated;
GRANT ALL ON public.commission_entry_splits TO service_role;
ALTER TABLE public.commission_entry_splits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ces read" ON public.commission_entry_splits FOR SELECT TO authenticated USING (public.comm_can_read(auth.uid()) OR employee_id = auth.uid());
CREATE POLICY "ces write" ON public.commission_entry_splits FOR ALL TO authenticated USING (public.comm_can_manage(auth.uid())) WITH CHECK (public.comm_can_manage(auth.uid()));

-- ============ CONDITIONS (Ampel) ============
CREATE TABLE public.commission_conditions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid NOT NULL REFERENCES public.commission_entries(id) ON DELETE CASCADE,
  condition_key text NOT NULL,
  label text NOT NULL,
  state text NOT NULL DEFAULT 'yellow',
  detail text,
  checked_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entry_id, condition_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commission_conditions TO authenticated;
GRANT ALL ON public.commission_conditions TO service_role;
ALTER TABLE public.commission_conditions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cc read" ON public.commission_conditions FOR SELECT TO authenticated USING (public.comm_can_read(auth.uid()));
CREATE POLICY "cc write" ON public.commission_conditions FOR ALL TO authenticated USING (public.comm_can_manage(auth.uid())) WITH CHECK (public.comm_can_manage(auth.uid()));

-- ============ APPROVALS ============
CREATE TABLE public.commission_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid NOT NULL REFERENCES public.commission_entries(id) ON DELETE CASCADE,
  step text NOT NULL DEFAULT 'admin',
  decision text NOT NULL,
  reason text,
  decided_by uuid NOT NULL,
  decided_by_name text,
  decided_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.commission_approvals TO authenticated;
GRANT ALL ON public.commission_approvals TO service_role;
ALTER TABLE public.commission_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "capp read" ON public.commission_approvals FOR SELECT TO authenticated USING (public.comm_can_read(auth.uid()));
CREATE POLICY "capp insert" ON public.commission_approvals FOR INSERT TO authenticated WITH CHECK (public.comm_can_manage(auth.uid()));

-- ============ PAYMENTS ============
CREATE TABLE public.commission_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_number text,
  employee_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
  period_start date,
  period_end date,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  payment_method text NOT NULL DEFAULT 'bank_transfer',
  bank_account text,
  booking_reference text,
  purpose text,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  cost_center text,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commission_payments TO authenticated;
GRANT ALL ON public.commission_payments TO service_role;
ALTER TABLE public.commission_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cp read" ON public.commission_payments FOR SELECT TO authenticated USING (public.comm_can_read(auth.uid()) OR employee_id = auth.uid());
CREATE POLICY "cp insert" ON public.commission_payments FOR INSERT TO authenticated WITH CHECK (public.comm_can_manage(auth.uid()));
CREATE POLICY "cp update" ON public.commission_payments FOR UPDATE TO authenticated USING (public.comm_can_manage(auth.uid())) WITH CHECK (public.comm_can_manage(auth.uid()));
CREATE POLICY "cp delete" ON public.commission_payments FOR DELETE TO authenticated USING (public.has_role('Super Admin'));
CREATE TRIGGER trg_commission_payments_touch BEFORE UPDATE ON public.commission_payments FOR EACH ROW EXECUTE FUNCTION public.comm_touch();

CREATE TABLE public.commission_payment_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES public.commission_payments(id) ON DELETE CASCADE,
  entry_id uuid NOT NULL REFERENCES public.commission_entries(id) ON DELETE RESTRICT,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (payment_id, entry_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commission_payment_items TO authenticated;
GRANT ALL ON public.commission_payment_items TO service_role;
ALTER TABLE public.commission_payment_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cpi read" ON public.commission_payment_items FOR SELECT TO authenticated USING (public.comm_can_read(auth.uid()));
CREATE POLICY "cpi write" ON public.commission_payment_items FOR ALL TO authenticated USING (public.comm_can_manage(auth.uid())) WITH CHECK (public.comm_can_manage(auth.uid()));

-- ============ ADJUSTMENTS / REVERSALS ============
CREATE TABLE public.commission_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid NOT NULL REFERENCES public.commission_entries(id) ON DELETE CASCADE,
  adjustment_type text NOT NULL DEFAULT 'correction',
  amount numeric(14,2) NOT NULL,
  reason text NOT NULL,
  reference text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.commission_adjustments TO authenticated;
GRANT ALL ON public.commission_adjustments TO service_role;
ALTER TABLE public.commission_adjustments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cadj read" ON public.commission_adjustments FOR SELECT TO authenticated USING (public.comm_can_read(auth.uid()));
CREATE POLICY "cadj insert" ON public.commission_adjustments FOR INSERT TO authenticated WITH CHECK (public.comm_can_manage(auth.uid()));

CREATE TABLE public.commission_reversals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid NOT NULL REFERENCES public.commission_entries(id) ON DELETE CASCADE,
  reversal_type text NOT NULL DEFAULT 'cancellation',
  reason_code text NOT NULL DEFAULT 'storno',
  reason text,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  is_reclaim boolean NOT NULL DEFAULT false,
  related_return_debit_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.commission_reversals TO authenticated;
GRANT ALL ON public.commission_reversals TO service_role;
ALTER TABLE public.commission_reversals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crev read" ON public.commission_reversals FOR SELECT TO authenticated USING (public.comm_can_read(auth.uid()));
CREATE POLICY "crev insert" ON public.commission_reversals FOR INSERT TO authenticated WITH CHECK (public.comm_can_manage(auth.uid()));

-- ============ STATEMENTS ============
CREATE TABLE public.commission_statements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  statement_number text,
  employee_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  total_amount numeric(14,2) NOT NULL DEFAULT 0,
  corrections_amount numeric(14,2) NOT NULL DEFAULT 0,
  reclaims_amount numeric(14,2) NOT NULL DEFAULT 0,
  already_paid_amount numeric(14,2) NOT NULL DEFAULT 0,
  payout_amount numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  status text NOT NULL DEFAULT 'draft',
  entry_ids uuid[] NOT NULL DEFAULT '{}',
  document_id uuid,
  pdf_url text,
  released_by uuid,
  released_at timestamptz,
  paid_at timestamptz,
  internal_notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commission_statements TO authenticated;
GRANT ALL ON public.commission_statements TO service_role;
ALTER TABLE public.commission_statements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cst read" ON public.commission_statements FOR SELECT TO authenticated
  USING (public.comm_can_read(auth.uid()) OR (employee_id = auth.uid() AND status IN ('released','paid')));
CREATE POLICY "cst insert" ON public.commission_statements FOR INSERT TO authenticated WITH CHECK (public.comm_can_manage(auth.uid()));
CREATE POLICY "cst update" ON public.commission_statements FOR UPDATE TO authenticated USING (public.comm_can_manage(auth.uid())) WITH CHECK (public.comm_can_manage(auth.uid()));
CREATE POLICY "cst delete" ON public.commission_statements FOR DELETE TO authenticated USING (public.has_role('Super Admin'));
CREATE TRIGGER trg_commission_statements_touch BEFORE UPDATE ON public.commission_statements FOR EACH ROW EXECUTE FUNCTION public.comm_touch();

-- ============ HISTORY / NOTIFICATIONS / AUDIT ============
CREATE TABLE public.commission_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid NOT NULL REFERENCES public.commission_entries(id) ON DELETE CASCADE,
  old_status public.commission_status,
  new_status public.commission_status NOT NULL,
  reason text,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.commission_status_history TO authenticated;
GRANT ALL ON public.commission_status_history TO service_role;
ALTER TABLE public.commission_status_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "csh read" ON public.commission_status_history FOR SELECT TO authenticated USING (public.comm_can_read(auth.uid()));
CREATE POLICY "csh insert" ON public.commission_status_history FOR INSERT TO authenticated WITH CHECK (true);

CREATE TABLE public.commission_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  entry_id uuid REFERENCES public.commission_entries(id) ON DELETE CASCADE,
  recipient_id uuid,
  recipient_role text,
  title text NOT NULL,
  message text,
  is_read boolean NOT NULL DEFAULT false,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.commission_notifications TO authenticated;
GRANT ALL ON public.commission_notifications TO service_role;
ALTER TABLE public.commission_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cn read" ON public.commission_notifications FOR SELECT TO authenticated USING (public.comm_can_read(auth.uid()) OR recipient_id = auth.uid());
CREATE POLICY "cn update" ON public.commission_notifications FOR UPDATE TO authenticated USING (public.comm_can_manage(auth.uid()) OR recipient_id = auth.uid()) WITH CHECK (public.comm_can_manage(auth.uid()) OR recipient_id = auth.uid());
CREATE POLICY "cn insert" ON public.commission_notifications FOR INSERT TO authenticated WITH CHECK (public.comm_can_manage(auth.uid()));

CREATE TABLE public.commission_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  object_type text NOT NULL,
  object_id uuid,
  entry_id uuid,
  order_id uuid,
  employee_id uuid,
  old_value jsonb,
  new_value jsonb,
  reason text,
  user_id uuid,
  user_name text,
  user_role text,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.commission_audit_logs TO authenticated;
GRANT ALL ON public.commission_audit_logs TO service_role;
ALTER TABLE public.commission_audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cal read" ON public.commission_audit_logs FOR SELECT TO authenticated USING (public.comm_can_read(auth.uid()));
CREATE POLICY "cal insert" ON public.commission_audit_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE INDEX idx_comm_audit_created ON public.commission_audit_logs(created_at DESC);

-- ============ SETTINGS ============
CREATE TABLE public.commission_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  rounding_mode text NOT NULL DEFAULT 'half_up',
  rounding_decimals integer NOT NULL DEFAULT 2,
  default_currency text NOT NULL DEFAULT 'EUR',
  approval_threshold_amount numeric(14,2) NOT NULL DEFAULT 5000,
  four_eyes_enabled boolean NOT NULL DEFAULT true,
  max_percent_without_superadmin numeric(7,4) NOT NULL DEFAULT 10,
  notify_emails text[] NOT NULL DEFAULT '{}',
  auto_calculate_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commission_settings TO authenticated;
GRANT ALL ON public.commission_settings TO service_role;
ALTER TABLE public.commission_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cs read" ON public.commission_settings FOR SELECT TO authenticated USING (public.comm_can_read(auth.uid()));
CREATE POLICY "cs write" ON public.commission_settings FOR ALL TO authenticated USING (public.comm_can_manage(auth.uid())) WITH CHECK (public.comm_can_manage(auth.uid()));
CREATE TRIGGER trg_commission_settings_touch BEFORE UPDATE ON public.commission_settings FOR EACH ROW EXECUTE FUNCTION public.comm_touch();

-- status history trigger
CREATE OR REPLACE FUNCTION public.commission_log_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.commission_status_history(entry_id, old_status, new_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid());
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.commission_status_history(entry_id, new_status, changed_by)
    VALUES (NEW.id, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_commission_status_log AFTER INSERT OR UPDATE ON public.commission_entries FOR EACH ROW EXECUTE FUNCTION public.commission_log_status();
