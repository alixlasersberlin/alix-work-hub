-- 45 Playbooks
CREATE TABLE public.collect_playbooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  label text NOT NULL,
  description text,
  active boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 100,
  match_customer_type text,
  match_country text,
  match_min_amount numeric,
  match_tags text[] NOT NULL DEFAULT '{}',
  grace_days integer NOT NULL DEFAULT 0,
  first_channel text NOT NULL DEFAULT 'email',
  tone text NOT NULL DEFAULT 'neutral',
  language text NOT NULL DEFAULT 'de',
  pause_on_complaint boolean NOT NULL DEFAULT false,
  notify_leasing boolean NOT NULL DEFAULT false,
  escalate_to text,
  personal_call boolean NOT NULL DEFAULT false,
  watch_installments boolean NOT NULL DEFAULT false,
  max_stage text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.collect_playbooks TO authenticated;
GRANT ALL ON public.collect_playbooks TO service_role;
ALTER TABLE public.collect_playbooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY collect_playbooks_sel ON public.collect_playbooks FOR SELECT TO authenticated USING (can_access_finance());
CREATE POLICY collect_playbooks_ins ON public.collect_playbooks FOR INSERT TO authenticated WITH CHECK (can_access_finance());
CREATE POLICY collect_playbooks_upd ON public.collect_playbooks FOR UPDATE TO authenticated USING (can_access_finance());
CREATE POLICY collect_playbooks_del ON public.collect_playbooks FOR DELETE TO authenticated USING (has_role('Super Admin'));

-- 23 Health Score
CREATE TABLE public.collect_health_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid,
  customer_name text,
  score integer NOT NULL DEFAULT 0,
  grade text,
  revenue_score integer DEFAULT 0,
  complaint_score integer DEFAULT 0,
  service_score integer DEFAULT 0,
  return_debit_score integer DEFAULT 0,
  dunning_score integer DEFAULT 0,
  ticket_score integer DEFAULT 0,
  response_score integer DEFAULT 0,
  leasing_score integer DEFAULT 0,
  warranty_score integer DEFAULT 0,
  order_frequency_score integer DEFAULT 0,
  credit_score integer DEFAULT 0,
  tenure_score integer DEFAULT 0,
  components jsonb NOT NULL DEFAULT '{}',
  trend text,
  computed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_collect_health_customer ON public.collect_health_scores (customer_id) WHERE customer_id IS NOT NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.collect_health_scores TO authenticated;
GRANT ALL ON public.collect_health_scores TO service_role;
ALTER TABLE public.collect_health_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY collect_health_sel ON public.collect_health_scores FOR SELECT TO authenticated USING (can_access_finance());
CREATE POLICY collect_health_ins ON public.collect_health_scores FOR INSERT TO authenticated WITH CHECK (can_access_finance());
CREATE POLICY collect_health_upd ON public.collect_health_scores FOR UPDATE TO authenticated USING (can_access_finance());
CREATE POLICY collect_health_del ON public.collect_health_scores FOR DELETE TO authenticated USING (has_role('Super Admin'));

-- 30 Verkäuferbewertung
CREATE TABLE public.collect_seller_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid,
  seller_name text NOT NULL,
  period text NOT NULL DEFAULT 'all',
  payment_quality_pct numeric NOT NULL DEFAULT 0,
  customers_count integer NOT NULL DEFAULT 0,
  invoiced_amount numeric NOT NULL DEFAULT 0,
  overdue_amount numeric NOT NULL DEFAULT 0,
  avg_days_overdue numeric NOT NULL DEFAULT 0,
  bad_debt_amount numeric NOT NULL DEFAULT 0,
  computed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_collect_seller_period ON public.collect_seller_scores (seller_name, period);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.collect_seller_scores TO authenticated;
GRANT ALL ON public.collect_seller_scores TO service_role;
ALTER TABLE public.collect_seller_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY collect_seller_sel ON public.collect_seller_scores FOR SELECT TO authenticated USING (can_access_finance());
CREATE POLICY collect_seller_ins ON public.collect_seller_scores FOR INSERT TO authenticated WITH CHECK (can_access_finance());
CREATE POLICY collect_seller_upd ON public.collect_seller_scores FOR UPDATE TO authenticated USING (can_access_finance());
CREATE POLICY collect_seller_del ON public.collect_seller_scores FOR DELETE TO authenticated USING (has_role('Super Admin'));

-- 31/32 Mahnkosten & Verzugszinsen
CREATE TABLE public.collect_fee_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL DEFAULT 'DE',
  tenant text,
  customer_group text,
  stage_code text,
  fee_amount numeric NOT NULL DEFAULT 0,
  interest_rate_pct numeric NOT NULL DEFAULT 9.12,
  base_rate_pct numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  active boolean NOT NULL DEFAULT true,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.collect_fee_rules TO authenticated;
GRANT ALL ON public.collect_fee_rules TO service_role;
ALTER TABLE public.collect_fee_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY collect_fee_sel ON public.collect_fee_rules FOR SELECT TO authenticated USING (can_access_finance());
CREATE POLICY collect_fee_ins ON public.collect_fee_rules FOR INSERT TO authenticated WITH CHECK (can_access_finance());
CREATE POLICY collect_fee_upd ON public.collect_fee_rules FOR UPDATE TO authenticated USING (can_access_finance());
CREATE POLICY collect_fee_del ON public.collect_fee_rules FOR DELETE TO authenticated USING (has_role('Super Admin'));

-- 37 Zahlungsziel ändern
CREATE TABLE public.collect_payment_term_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid REFERENCES public.collect_cases(id) ON DELETE CASCADE,
  customer_id uuid,
  customer_name text,
  invoice_reference text,
  old_term_days integer,
  new_term_days integer NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'pending',
  requested_by uuid,
  requested_at timestamptz NOT NULL DEFAULT now(),
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.collect_payment_term_changes TO authenticated;
GRANT ALL ON public.collect_payment_term_changes TO service_role;
ALTER TABLE public.collect_payment_term_changes ENABLE ROW LEVEL SECURITY;
CREATE POLICY collect_ptc_sel ON public.collect_payment_term_changes FOR SELECT TO authenticated USING (can_access_finance());
CREATE POLICY collect_ptc_ins ON public.collect_payment_term_changes FOR INSERT TO authenticated WITH CHECK (can_access_finance());
CREATE POLICY collect_ptc_upd ON public.collect_payment_term_changes FOR UPDATE TO authenticated USING (can_access_finance());
CREATE POLICY collect_ptc_del ON public.collect_payment_term_changes FOR DELETE TO authenticated USING (has_role('Super Admin'));

-- 38 Interne Freigaben
CREATE TABLE public.collect_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid,
  customer_name text,
  amount numeric NOT NULL DEFAULT 0,
  level text NOT NULL DEFAULT 'finance',
  status text NOT NULL DEFAULT 'pending',
  title text,
  note text,
  requested_by uuid,
  requested_at timestamptz NOT NULL DEFAULT now(),
  decided_by uuid,
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.collect_approvals TO authenticated;
GRANT ALL ON public.collect_approvals TO service_role;
ALTER TABLE public.collect_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY collect_appr_sel ON public.collect_approvals FOR SELECT TO authenticated USING (can_access_finance());
CREATE POLICY collect_appr_ins ON public.collect_approvals FOR INSERT TO authenticated WITH CHECK (can_access_finance());
CREATE POLICY collect_appr_upd ON public.collect_approvals FOR UPDATE TO authenticated USING (can_access_finance());
CREATE POLICY collect_appr_del ON public.collect_approvals FOR DELETE TO authenticated USING (has_role('Super Admin'));

-- 44 Morgenreport
CREATE TABLE public.collect_morning_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date date NOT NULL DEFAULT current_date,
  summary text,
  kpis jsonb NOT NULL DEFAULT '{}',
  recommendations jsonb NOT NULL DEFAULT '[]',
  generated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_collect_morning_date ON public.collect_morning_reports (report_date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.collect_morning_reports TO authenticated;
GRANT ALL ON public.collect_morning_reports TO service_role;
ALTER TABLE public.collect_morning_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY collect_morn_sel ON public.collect_morning_reports FOR SELECT TO authenticated USING (can_access_finance());
CREATE POLICY collect_morn_ins ON public.collect_morning_reports FOR INSERT TO authenticated WITH CHECK (can_access_finance());
CREATE POLICY collect_morn_upd ON public.collect_morning_reports FOR UPDATE TO authenticated USING (can_access_finance());
CREATE POLICY collect_morn_del ON public.collect_morning_reports FOR DELETE TO authenticated USING (has_role('Super Admin'));

-- 42 Liquiditätsprognose
CREATE TABLE public.collect_liquidity_forecast (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  forecast_date date NOT NULL DEFAULT current_date,
  horizon_days integer NOT NULL,
  secure_amount numeric NOT NULL DEFAULT 0,
  probable_amount numeric NOT NULL DEFAULT 0,
  uncertain_amount numeric NOT NULL DEFAULT 0,
  expected_loss numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_collect_forecast ON public.collect_liquidity_forecast (forecast_date, horizon_days);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.collect_liquidity_forecast TO authenticated;
GRANT ALL ON public.collect_liquidity_forecast TO service_role;
ALTER TABLE public.collect_liquidity_forecast ENABLE ROW LEVEL SECURITY;
CREATE POLICY collect_liq_sel ON public.collect_liquidity_forecast FOR SELECT TO authenticated USING (can_access_finance());
CREATE POLICY collect_liq_ins ON public.collect_liquidity_forecast FOR INSERT TO authenticated WITH CHECK (can_access_finance());
CREATE POLICY collect_liq_upd ON public.collect_liquidity_forecast FOR UPDATE TO authenticated USING (can_access_finance());
CREATE POLICY collect_liq_del ON public.collect_liquidity_forecast FOR DELETE TO authenticated USING (has_role('Super Admin'));

-- 27 Geräteverknüpfung
CREATE TABLE public.collect_device_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid REFERENCES public.collect_cases(id) ON DELETE CASCADE,
  customer_id uuid,
  customer_name text,
  invoice_reference text,
  device_model text,
  serial_number text,
  handpiece text,
  warranty_until date,
  spare_parts_block boolean NOT NULL DEFAULT false,
  comfort_features_block boolean NOT NULL DEFAULT false,
  block_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.collect_device_links TO authenticated;
GRANT ALL ON public.collect_device_links TO service_role;
ALTER TABLE public.collect_device_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY collect_dev_sel ON public.collect_device_links FOR SELECT TO authenticated USING (can_access_finance());
CREATE POLICY collect_dev_ins ON public.collect_device_links FOR INSERT TO authenticated WITH CHECK (can_access_finance());
CREATE POLICY collect_dev_upd ON public.collect_device_links FOR UPDATE TO authenticated USING (can_access_finance());
CREATE POLICY collect_dev_del ON public.collect_device_links FOR DELETE TO authenticated USING (has_role('Super Admin'));

-- Fälle erweitern
ALTER TABLE public.collect_cases
  ADD COLUMN IF NOT EXISTS playbook_code text,
  ADD COLUMN IF NOT EXISTS health_score integer,
  ADD COLUMN IF NOT EXISTS seller_name text,
  ADD COLUMN IF NOT EXISTS complaint_hold boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS complaint_hold_reason text,
  ADD COLUMN IF NOT EXISTS country_code text,
  ADD COLUMN IF NOT EXISTS customer_type text,
  ADD COLUMN IF NOT EXISTS payment_term_days integer;

-- Standard-Playbooks
INSERT INTO public.collect_playbooks (code, label, description, priority, match_customer_type, grace_days, first_channel, tone, pause_on_complaint, notify_leasing, escalate_to, personal_call, watch_installments)
VALUES
  ('neukunde','Neukunden','Freundliche Erinnerungen, kurze Reaktionszeiten',10,'neukunde',2,'email','freundlich',true,false,null,false,false),
  ('stammkunde','Stammkunden','Persönlicher Ansprechpartner, längere Kulanz',20,'stammkunde',7,'phone','persoenlich',true,false,'account_manager',true,false),
  ('haendler','Händler','Eskalation über Gebietsleiter und Kreditlimit',30,'haendler',3,'email','sachlich',true,false,'gebietsleiter',false,false),
  ('leasing','Leasingkunden','Leasinggesellschaft einbinden',40,'leasing',5,'email','sachlich',true,true,'leasinggesellschaft',false,false),
  ('international','Internationale Kunden','Landessprache, Fristen und Vorlagen je Land',50,'international',5,'email','sachlich',true,false,null,false,false),
  ('reklamation','Kunden mit Reklamation','Mahnprozess pausieren bis geklärt',5,'reklamation',30,'phone','freundlich',true,false,null,true,false),
  ('ratenzahler','Ratenzahler','Jede Rate überwachen, sofortige Reaktivierung bei Verzug',15,'ratenzahler',1,'email','sachlich',false,false,null,false,true)
ON CONFLICT (code) DO NOTHING;

-- Standard-Mahnkosten je Land
INSERT INTO public.collect_fee_rules (country_code, stage_code, fee_amount, interest_rate_pct, currency)
VALUES
  ('DE','reminder',0,9.12,'EUR'),
  ('DE','dunning_1',5,9.12,'EUR'),
  ('DE','dunning_2',10,9.12,'EUR'),
  ('DE','dunning_3',15,9.12,'EUR'),
  ('AT','dunning_1',8,9.20,'EUR'),
  ('AT','dunning_2',15,9.20,'EUR'),
  ('BE','dunning_1',10,10.50,'EUR'),
  ('AE','dunning_1',25,12.00,'AED'),
  ('US','dunning_1',20,10.00,'USD');
