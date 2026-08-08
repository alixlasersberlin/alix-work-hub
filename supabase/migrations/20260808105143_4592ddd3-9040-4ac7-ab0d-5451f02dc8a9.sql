CREATE TABLE public.collect_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid,
  customer_name text NOT NULL,
  customer_email text,
  customer_phone text,
  currency text NOT NULL DEFAULT 'EUR',
  open_amount numeric NOT NULL DEFAULT 0,
  overdue_amount numeric NOT NULL DEFAULT 0,
  interest_amount numeric NOT NULL DEFAULT 0,
  fee_amount numeric NOT NULL DEFAULT 0,
  oldest_due_date date,
  max_days_overdue integer NOT NULL DEFAULT 0,
  stage_code text NOT NULL DEFAULT 'pre_due',
  stage_day integer NOT NULL DEFAULT -7,
  ampel text NOT NULL DEFAULT 'gruen',
  status text NOT NULL DEFAULT 'active',
  risk_score integer,
  pay_probability_pct integer,
  risk_class text,
  ai_recommendation text,
  ai_reasoning text,
  ai_updated_at timestamptz,
  priority integer NOT NULL DEFAULT 0,
  next_action text,
  next_action_at timestamptz,
  last_contact_at timestamptz,
  paused_until date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.collect_cases TO authenticated;
GRANT ALL ON public.collect_cases TO service_role;
ALTER TABLE public.collect_cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "collect_cases_select" ON public.collect_cases FOR SELECT TO authenticated USING (public.can_access_finance());
CREATE POLICY "collect_cases_insert" ON public.collect_cases FOR INSERT TO authenticated WITH CHECK (public.can_access_finance());
CREATE POLICY "collect_cases_update" ON public.collect_cases FOR UPDATE TO authenticated USING (public.can_access_finance()) WITH CHECK (public.can_access_finance());
CREATE POLICY "collect_cases_delete" ON public.collect_cases FOR DELETE TO authenticated USING (public.has_role('Super Admin'));
CREATE INDEX idx_collect_cases_customer ON public.collect_cases(customer_id);
CREATE INDEX idx_collect_cases_stage ON public.collect_cases(stage_code, status);
CREATE UNIQUE INDEX uq_collect_cases_customer_active ON public.collect_cases(customer_id) WHERE customer_id IS NOT NULL AND status <> 'closed';

CREATE TABLE public.collect_case_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.collect_cases(id) ON DELETE CASCADE,
  invoice_id uuid,
  invoice_number text,
  invoice_date date,
  due_date date,
  total numeric NOT NULL DEFAULT 0,
  balance numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  days_overdue integer NOT NULL DEFAULT 0,
  interest_amount numeric NOT NULL DEFAULT 0,
  fee_amount numeric NOT NULL DEFAULT 0,
  stage_code text,
  is_deposit boolean NOT NULL DEFAULT false,
  source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.collect_case_items TO authenticated;
GRANT ALL ON public.collect_case_items TO service_role;
ALTER TABLE public.collect_case_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "collect_case_items_select" ON public.collect_case_items FOR SELECT TO authenticated USING (public.can_access_finance());
CREATE POLICY "collect_case_items_insert" ON public.collect_case_items FOR INSERT TO authenticated WITH CHECK (public.can_access_finance());
CREATE POLICY "collect_case_items_update" ON public.collect_case_items FOR UPDATE TO authenticated USING (public.can_access_finance()) WITH CHECK (public.can_access_finance());
CREATE POLICY "collect_case_items_delete" ON public.collect_case_items FOR DELETE TO authenticated USING (public.has_role('Super Admin'));
CREATE INDEX idx_collect_items_case ON public.collect_case_items(case_id);
CREATE UNIQUE INDEX uq_collect_items_case_invoice ON public.collect_case_items(case_id, invoice_number);

CREATE TABLE public.collect_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.collect_cases(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  channel text,
  direction text NOT NULL DEFAULT 'out',
  stage_code text,
  subject text,
  body text,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor uuid,
  actor_email text,
  automated boolean NOT NULL DEFAULT false,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.collect_events TO authenticated;
GRANT ALL ON public.collect_events TO service_role;
ALTER TABLE public.collect_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "collect_events_select" ON public.collect_events FOR SELECT TO authenticated USING (public.can_access_finance());
CREATE POLICY "collect_events_insert" ON public.collect_events FOR INSERT TO authenticated WITH CHECK (public.can_access_finance());
CREATE POLICY "collect_events_update" ON public.collect_events FOR UPDATE TO authenticated USING (public.can_access_finance()) WITH CHECK (public.can_access_finance());
CREATE POLICY "collect_events_delete" ON public.collect_events FOR DELETE TO authenticated USING (public.has_role('Super Admin'));
CREATE INDEX idx_collect_events_case ON public.collect_events(case_id, occurred_at DESC);

CREATE TABLE public.collect_stage_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  label text NOT NULL,
  day_offset integer NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  channels text[] NOT NULL DEFAULT ARRAY['email']::text[],
  ampel text NOT NULL DEFAULT 'gruen',
  fee_amount numeric NOT NULL DEFAULT 0,
  interest_rate_pct numeric NOT NULL DEFAULT 0,
  attach_pdf boolean NOT NULL DEFAULT false,
  pay_now_link boolean NOT NULL DEFAULT false,
  cc_management boolean NOT NULL DEFAULT false,
  create_call_task boolean NOT NULL DEFAULT false,
  set_blocks text[] NOT NULL DEFAULT ARRAY[]::text[],
  notify_sales boolean NOT NULL DEFAULT false,
  decision_stage boolean NOT NULL DEFAULT false,
  email_subject text,
  email_body text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.collect_stage_config TO authenticated;
GRANT ALL ON public.collect_stage_config TO service_role;
ALTER TABLE public.collect_stage_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "collect_stage_config_select" ON public.collect_stage_config FOR SELECT TO authenticated USING (public.can_access_finance());
CREATE POLICY "collect_stage_config_insert" ON public.collect_stage_config FOR INSERT TO authenticated WITH CHECK (public.can_access_finance());
CREATE POLICY "collect_stage_config_update" ON public.collect_stage_config FOR UPDATE TO authenticated USING (public.can_access_finance()) WITH CHECK (public.can_access_finance());
CREATE POLICY "collect_stage_config_delete" ON public.collect_stage_config FOR DELETE TO authenticated USING (public.has_role('Super Admin'));

CREATE TABLE public.collect_payment_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.collect_cases(id) ON DELETE CASCADE,
  customer_id uuid,
  total_amount numeric NOT NULL DEFAULT 0,
  downpayment numeric NOT NULL DEFAULT 0,
  monthly_amount numeric NOT NULL DEFAULT 0,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  term_months integer NOT NULL DEFAULT 1,
  currency text NOT NULL DEFAULT 'EUR',
  sepa_mandate_ref text,
  sepa_iban_masked text,
  signature_request_id uuid,
  signed_at timestamptz,
  status text NOT NULL DEFAULT 'draft',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.collect_payment_plans TO authenticated;
GRANT ALL ON public.collect_payment_plans TO service_role;
ALTER TABLE public.collect_payment_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "collect_plans_select" ON public.collect_payment_plans FOR SELECT TO authenticated USING (public.can_access_finance());
CREATE POLICY "collect_plans_insert" ON public.collect_payment_plans FOR INSERT TO authenticated WITH CHECK (public.can_access_finance());
CREATE POLICY "collect_plans_update" ON public.collect_payment_plans FOR UPDATE TO authenticated USING (public.can_access_finance()) WITH CHECK (public.can_access_finance());
CREATE POLICY "collect_plans_delete" ON public.collect_payment_plans FOR DELETE TO authenticated USING (public.has_role('Super Admin'));

CREATE TABLE public.collect_payment_plan_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.collect_payment_plans(id) ON DELETE CASCADE,
  seq integer NOT NULL,
  due_date date NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  paid_amount numeric NOT NULL DEFAULT 0,
  paid_at timestamptz,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.collect_payment_plan_items TO authenticated;
GRANT ALL ON public.collect_payment_plan_items TO service_role;
ALTER TABLE public.collect_payment_plan_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "collect_plan_items_select" ON public.collect_payment_plan_items FOR SELECT TO authenticated USING (public.can_access_finance());
CREATE POLICY "collect_plan_items_insert" ON public.collect_payment_plan_items FOR INSERT TO authenticated WITH CHECK (public.can_access_finance());
CREATE POLICY "collect_plan_items_update" ON public.collect_payment_plan_items FOR UPDATE TO authenticated USING (public.can_access_finance()) WITH CHECK (public.can_access_finance());
CREATE POLICY "collect_plan_items_delete" ON public.collect_payment_plan_items FOR DELETE TO authenticated USING (public.has_role('Super Admin'));
CREATE INDEX idx_collect_plan_items_plan ON public.collect_payment_plan_items(plan_id, seq);

CREATE TABLE public.collect_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid REFERENCES public.collect_cases(id) ON DELETE CASCADE,
  customer_id uuid,
  block_type text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  reason text,
  set_by uuid,
  set_automatically boolean NOT NULL DEFAULT true,
  released_by uuid,
  released_at timestamptz,
  release_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.collect_blocks TO authenticated;
GRANT ALL ON public.collect_blocks TO service_role;
ALTER TABLE public.collect_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "collect_blocks_select" ON public.collect_blocks FOR SELECT TO authenticated USING (true);
CREATE POLICY "collect_blocks_insert" ON public.collect_blocks FOR INSERT TO authenticated WITH CHECK (public.can_access_finance());
CREATE POLICY "collect_blocks_update" ON public.collect_blocks FOR UPDATE TO authenticated USING (public.can_access_finance()) WITH CHECK (public.can_access_finance());
CREATE POLICY "collect_blocks_delete" ON public.collect_blocks FOR DELETE TO authenticated USING (public.has_role('Super Admin'));
CREATE INDEX idx_collect_blocks_customer ON public.collect_blocks(customer_id) WHERE active;

CREATE OR REPLACE FUNCTION public.collect_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_collect_cases_touch BEFORE UPDATE ON public.collect_cases FOR EACH ROW EXECUTE FUNCTION public.collect_touch_updated_at();
CREATE TRIGGER trg_collect_items_touch BEFORE UPDATE ON public.collect_case_items FOR EACH ROW EXECUTE FUNCTION public.collect_touch_updated_at();
CREATE TRIGGER trg_collect_stage_touch BEFORE UPDATE ON public.collect_stage_config FOR EACH ROW EXECUTE FUNCTION public.collect_touch_updated_at();
CREATE TRIGGER trg_collect_plans_touch BEFORE UPDATE ON public.collect_payment_plans FOR EACH ROW EXECUTE FUNCTION public.collect_touch_updated_at();
CREATE TRIGGER trg_collect_plan_items_touch BEFORE UPDATE ON public.collect_payment_plan_items FOR EACH ROW EXECUTE FUNCTION public.collect_touch_updated_at();
CREATE TRIGGER trg_collect_blocks_touch BEFORE UPDATE ON public.collect_blocks FOR EACH ROW EXECUTE FUNCTION public.collect_touch_updated_at();

INSERT INTO public.collect_stage_config (code,label,day_offset,sort_order,channels,ampel,fee_amount,interest_rate_pct,attach_pdf,pay_now_link,cc_management,create_call_task,set_blocks,notify_sales,decision_stage,email_subject) VALUES
 ('pre_due','Vorfälligkeitsinfo',-7,10,ARRAY['email'],'gruen',0,0,false,false,false,false,ARRAY[]::text[],false,false,'Ihre Rechnung wird in Kürze fällig'),
 ('due','Fälligkeit',0,20,ARRAY['email'],'gelb',0,0,true,true,false,false,ARRAY[]::text[],false,false,'Ihre Rechnung ist heute fällig'),
 ('reminder_friendly','Freundliche Erinnerung',3,30,ARRAY['email'],'gelb',0,0,false,true,false,false,ARRAY[]::text[],false,false,'Freundliche Zahlungserinnerung'),
 ('dunning_1','Mahnstufe 1',7,40,ARRAY['email'],'orange',0,0,true,true,false,false,ARRAY[]::text[],false,false,'1. Mahnung'),
 ('dunning_2','Mahnstufe 2',14,50,ARRAY['email','sms'],'rot',5,9.12,true,true,false,false,ARRAY[]::text[],false,false,'2. Mahnung'),
 ('call_task','Telefonaufgabe',21,60,ARRAY['task'],'rot',0,9.12,false,false,false,true,ARRAY[]::text[],false,false,NULL),
 ('dunning_3','Mahnstufe 3',30,70,ARRAY['email'],'rot',15,9.12,true,true,true,true,ARRAY[]::text[],true,false,'3. Mahnung – letzte Zahlungsaufforderung'),
 ('delivery_stop','Lieferstopp',45,80,ARRAY['email','task'],'rot',0,9.12,false,false,true,false,ARRAY['delivery','spare_parts','training','warranty','extension']::text[],true,false,'Lieferstopp wegen offener Forderungen'),
 ('decision','Automatische Entscheidung',60,90,ARRAY['task'],'schwarz',0,9.12,false,false,true,true,ARRAY['delivery','spare_parts','training','warranty','extension','offer','order']::text[],true,true,NULL);