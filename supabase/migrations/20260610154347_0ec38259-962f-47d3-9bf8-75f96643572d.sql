-- Phase 10: KI-Finanzanalyse & Anomalie-Erkennung

CREATE TABLE public.finance_ai_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  scope text NOT NULL,              -- 'cockpit' | 'bwa' | 'soll_ist' | 'forecast'
  period_start date,
  period_end date,
  prompt_hash text,
  prompt text,
  response text NOT NULL,
  model text,
  meta jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_finance_ai_insights_tenant ON public.finance_ai_insights(tenant_id, created_at DESC);
CREATE INDEX idx_finance_ai_insights_scope ON public.finance_ai_insights(scope, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_ai_insights TO authenticated;
GRANT ALL ON public.finance_ai_insights TO service_role;

ALTER TABLE public.finance_ai_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read finance_ai_insights" ON public.finance_ai_insights
  FOR SELECT TO authenticated
  USING (public.is_admin() OR public.has_role('Finance') OR public.has_role('Geschäftsführung'));

CREATE POLICY "Insert finance_ai_insights" ON public.finance_ai_insights
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.has_role('Finance') OR public.has_role('Geschäftsführung'));

CREATE POLICY "Update finance_ai_insights" ON public.finance_ai_insights
  FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.has_role('Finance'));

CREATE POLICY "Delete finance_ai_insights only Super Admin" ON public.finance_ai_insights
  FOR DELETE TO authenticated
  USING (public.has_role('Super Admin'));


CREATE TABLE public.finance_anomalies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  source_type text NOT NULL,        -- 'transaction' | 'incoming_invoice'
  source_id uuid,
  detected_at timestamptz NOT NULL DEFAULT now(),
  category text,
  amount numeric,
  reason text NOT NULL,             -- 'zscore_outlier' | 'duplicate_suspect' | 'unusual_supplier' | 'round_large_amount'
  severity text NOT NULL DEFAULT 'medium',  -- low|medium|high
  status text NOT NULL DEFAULT 'open',      -- open|reviewed|dismissed
  description text,
  meta jsonb,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_finance_anomalies_status ON public.finance_anomalies(status, detected_at DESC);
CREATE INDEX idx_finance_anomalies_tenant ON public.finance_anomalies(tenant_id, detected_at DESC);
CREATE UNIQUE INDEX uq_finance_anomalies_source ON public.finance_anomalies(source_type, source_id, reason) WHERE source_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_anomalies TO authenticated;
GRANT ALL ON public.finance_anomalies TO service_role;

ALTER TABLE public.finance_anomalies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read finance_anomalies" ON public.finance_anomalies
  FOR SELECT TO authenticated
  USING (public.is_admin() OR public.has_role('Finance') OR public.has_role('Geschäftsführung'));

CREATE POLICY "Insert finance_anomalies" ON public.finance_anomalies
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.has_role('Finance'));

CREATE POLICY "Update finance_anomalies" ON public.finance_anomalies
  FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.has_role('Finance'));

CREATE POLICY "Delete finance_anomalies only Super Admin" ON public.finance_anomalies
  FOR DELETE TO authenticated
  USING (public.has_role('Super Admin'));

CREATE TRIGGER trg_finance_anomalies_updated_at
  BEFORE UPDATE ON public.finance_anomalies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
