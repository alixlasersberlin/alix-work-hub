
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- Reusable role predicate for credit module
CREATE OR REPLACE FUNCTION public.credit_can_access()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT has_role('Super Admin') OR has_role('Admin') OR has_role('Geschäftsführung')
      OR has_role('Vertriebsleitung') OR has_role('Vertrieb') OR has_role('Finance');
$$;

CREATE OR REPLACE FUNCTION public.credit_is_super_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT has_role('Super Admin');
$$;

-- 1. credit_assessments
CREATE TABLE public.credit_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  offer_id UUID REFERENCES public.offers(id) ON DELETE SET NULL,
  customer_type TEXT NOT NULL DEFAULT 'company' CHECK (customer_type IN ('company','private')),
  customer_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  requested_amount NUMERIC(12,2),
  requested_term_months INTEGER,
  requested_downpayment_pct NUMERIC(5,2),
  purpose TEXT,
  score INTEGER,
  score_max INTEGER NOT NULL DEFAULT 1000,
  ampel TEXT CHECK (ampel IN ('gruen','gelb','orange','rot')),
  default_probability_pct NUMERIC(5,2),
  recommendation JSONB NOT NULL DEFAULT '{}'::jsonb,
  flags JSONB NOT NULL DEFAULT '[]'::jsonb,
  ai_summary TEXT,
  ai_model TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','calculating','pending_review','approved','approved_with_conditions','rejected','expired','cancelled')),
  workflow_stage TEXT NOT NULL DEFAULT 'sales'
    CHECK (workflow_stage IN ('auto','sales','sales_lead','management','done')),
  decided_by UUID,
  decided_at TIMESTAMPTZ,
  decision_notes TEXT,
  valid_until TIMESTAMPTZ,
  consent_given BOOLEAN NOT NULL DEFAULT false,
  consent_at TIMESTAMPTZ,
  consent_by UUID,
  created_by UUID NOT NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_credit_assessments_customer ON public.credit_assessments(customer_id);
CREATE INDEX idx_credit_assessments_order    ON public.credit_assessments(order_id);
CREATE INDEX idx_credit_assessments_status   ON public.credit_assessments(status);
CREATE INDEX idx_credit_assessments_created  ON public.credit_assessments(created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.credit_assessments TO authenticated;
GRANT ALL ON public.credit_assessments TO service_role;
ALTER TABLE public.credit_assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "credit_assessments_select" ON public.credit_assessments FOR SELECT TO authenticated USING (public.credit_can_access());
CREATE POLICY "credit_assessments_insert" ON public.credit_assessments FOR INSERT TO authenticated WITH CHECK (public.credit_can_access());
CREATE POLICY "credit_assessments_update" ON public.credit_assessments FOR UPDATE TO authenticated USING (public.credit_can_access()) WITH CHECK (public.credit_can_access());
CREATE POLICY "credit_assessments_delete" ON public.credit_assessments FOR DELETE TO authenticated USING (public.credit_is_super_admin());
CREATE TRIGGER trg_credit_assessments_updated_at BEFORE UPDATE ON public.credit_assessments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. credit_score_factors
CREATE TABLE public.credit_score_factors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES public.credit_assessments(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  label TEXT NOT NULL,
  points NUMERIC(6,2) NOT NULL DEFAULT 0,
  weight_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  source TEXT,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_credit_score_factors_assessment ON public.credit_score_factors(assessment_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.credit_score_factors TO authenticated;
GRANT ALL ON public.credit_score_factors TO service_role;
ALTER TABLE public.credit_score_factors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "credit_score_factors_select" ON public.credit_score_factors FOR SELECT TO authenticated USING (public.credit_can_access());
CREATE POLICY "credit_score_factors_insert" ON public.credit_score_factors FOR INSERT TO authenticated WITH CHECK (public.credit_can_access());
CREATE POLICY "credit_score_factors_update" ON public.credit_score_factors FOR UPDATE TO authenticated USING (public.credit_can_access()) WITH CHECK (public.credit_can_access());
CREATE POLICY "credit_score_factors_delete" ON public.credit_score_factors FOR DELETE TO authenticated USING (public.credit_is_super_admin());

-- 3. credit_documents
CREATE TABLE public.credit_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES public.credit_assessments(id) ON DELETE CASCADE,
  document_id UUID REFERENCES public.alixdocs2_documents(id) ON DELETE SET NULL,
  doc_type TEXT NOT NULL CHECK (doc_type IN ('schufa','lohnabrechnung','bwa','gewerbe','perso','hr_auszug','ust_id','bankverbindung','sonstiges')),
  title TEXT,
  verified BOOLEAN NOT NULL DEFAULT false,
  verified_by UUID,
  verified_at TIMESTAMPTZ,
  notes TEXT,
  created_by UUID NOT NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_credit_documents_assessment ON public.credit_documents(assessment_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.credit_documents TO authenticated;
GRANT ALL ON public.credit_documents TO service_role;
ALTER TABLE public.credit_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "credit_documents_select" ON public.credit_documents FOR SELECT TO authenticated USING (public.credit_can_access());
CREATE POLICY "credit_documents_insert" ON public.credit_documents FOR INSERT TO authenticated WITH CHECK (public.credit_can_access());
CREATE POLICY "credit_documents_update" ON public.credit_documents FOR UPDATE TO authenticated USING (public.credit_can_access()) WITH CHECK (public.credit_can_access());
CREATE POLICY "credit_documents_delete" ON public.credit_documents FOR DELETE TO authenticated USING (public.credit_is_super_admin());
CREATE TRIGGER trg_credit_documents_updated_at BEFORE UPDATE ON public.credit_documents FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. credit_external_checks
CREATE TABLE public.credit_external_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES public.credit_assessments(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('creditreform','northdata','bundesanzeiger','handelsregister','ust_id','linkedin','google','sonstiges')),
  reference TEXT,
  score_text TEXT,
  score_numeric NUMERIC(10,2),
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  checked_by UUID NOT NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_credit_external_checks_assessment ON public.credit_external_checks(assessment_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.credit_external_checks TO authenticated;
GRANT ALL ON public.credit_external_checks TO service_role;
ALTER TABLE public.credit_external_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "credit_external_checks_select" ON public.credit_external_checks FOR SELECT TO authenticated USING (public.credit_can_access());
CREATE POLICY "credit_external_checks_insert" ON public.credit_external_checks FOR INSERT TO authenticated WITH CHECK (public.credit_can_access());
CREATE POLICY "credit_external_checks_update" ON public.credit_external_checks FOR UPDATE TO authenticated USING (public.credit_can_access()) WITH CHECK (public.credit_can_access());
CREATE POLICY "credit_external_checks_delete" ON public.credit_external_checks FOR DELETE TO authenticated USING (public.credit_is_super_admin());
CREATE TRIGGER trg_credit_external_checks_updated_at BEFORE UPDATE ON public.credit_external_checks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. credit_decision_log (append-only)
CREATE TABLE public.credit_decision_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES public.credit_assessments(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('created','recalculated','submitted','approved','approved_with_conditions','rejected','escalated','cancelled','expired','consent_recorded','document_added','document_verified')),
  from_status TEXT,
  to_status TEXT,
  from_stage TEXT,
  to_stage TEXT,
  reason TEXT,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  actor UUID NOT NULL DEFAULT auth.uid(),
  actor_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_credit_decision_log_assessment ON public.credit_decision_log(assessment_id, created_at DESC);
GRANT SELECT, INSERT ON public.credit_decision_log TO authenticated;
GRANT ALL ON public.credit_decision_log TO service_role;
ALTER TABLE public.credit_decision_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "credit_decision_log_select" ON public.credit_decision_log FOR SELECT TO authenticated USING (public.credit_can_access());
CREATE POLICY "credit_decision_log_insert" ON public.credit_decision_log FOR INSERT TO authenticated WITH CHECK (public.credit_can_access());

-- 6. credit_policies
CREATE TABLE public.credit_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT true,
  weights JSONB NOT NULL DEFAULT '{}'::jsonb,
  bands JSONB NOT NULL DEFAULT '[]'::jsonb,
  retention_years INTEGER NOT NULL DEFAULT 3,
  auto_block_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.credit_policies TO authenticated;
GRANT ALL ON public.credit_policies TO service_role;
ALTER TABLE public.credit_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "credit_policies_select" ON public.credit_policies FOR SELECT TO authenticated USING (public.credit_can_access());
CREATE POLICY "credit_policies_write_super_admin" ON public.credit_policies FOR ALL TO authenticated USING (public.credit_is_super_admin()) WITH CHECK (public.credit_is_super_admin());
CREATE TRIGGER trg_credit_policies_updated_at BEFORE UPDATE ON public.credit_policies FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.credit_policies (name, active, weights, bands, retention_years, auto_block_rules)
VALUES (
  'default', true,
  '{"schufa":30,"einkommen":20,"beschaeftigung":10,"unternehmen":10,"historie":15,"alixsmart":5,"zahlungsverhalten":5,"dokumente":5}'::jsonb,
  '[
    {"min":900,"max":1000,"ampel":"gruen","label":"Premium","downpayment_pct":0,"term_months":84,"max_credit":50000,"decision_stage":"auto"},
    {"min":750,"max":899,"ampel":"gruen","label":"Gut","downpayment_pct":20,"term_months":72,"max_credit":30000,"decision_stage":"sales"},
    {"min":650,"max":749,"ampel":"gelb","label":"Mittel","downpayment_pct":40,"term_months":48,"max_credit":18000,"decision_stage":"sales_lead"},
    {"min":550,"max":649,"ampel":"orange","label":"Kritisch","downpayment_pct":60,"term_months":24,"max_credit":8000,"decision_stage":"management"},
    {"min":0,"max":549,"ampel":"rot","label":"Ablehnung","downpayment_pct":100,"term_months":0,"max_credit":0,"decision_stage":"auto"}
  ]'::jsonb,
  3,
  '{"open_receivables_max":0,"sepa_returns_max":0,"require_documents":["perso"],"min_score":550}'::jsonb
) ON CONFLICT (name) DO NOTHING;
