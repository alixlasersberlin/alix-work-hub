CREATE TABLE public.survey_automation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  trigger_event text NOT NULL DEFAULT 'order_delivered',
  survey_id uuid REFERENCES public.surveys(id) ON DELETE CASCADE,
  delay_days integer NOT NULL DEFAULT 3,
  min_gap_days integer NOT NULL DEFAULT 180,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.survey_automation_rules TO authenticated;
GRANT ALL ON public.survey_automation_rules TO service_role;
ALTER TABLE public.survey_automation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sv_rules_read" ON public.survey_automation_rules
  FOR SELECT TO authenticated USING (public.sv_can_read());
CREATE POLICY "sv_rules_insert" ON public.survey_automation_rules
  FOR INSERT TO authenticated WITH CHECK (public.sv_can_write());
CREATE POLICY "sv_rules_update" ON public.survey_automation_rules
  FOR UPDATE TO authenticated USING (public.sv_can_write()) WITH CHECK (public.sv_can_write());
CREATE POLICY "sv_rules_delete" ON public.survey_automation_rules
  FOR DELETE TO authenticated USING (public.has_role('Super Admin'));

CREATE TABLE public.survey_automation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid REFERENCES public.survey_automation_rules(id) ON DELETE CASCADE,
  survey_id uuid,
  source_ref text,
  customer_id uuid,
  email text,
  status text NOT NULL DEFAULT 'ok',
  error_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.survey_automation_runs TO authenticated;
GRANT ALL ON public.survey_automation_runs TO service_role;
ALTER TABLE public.survey_automation_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sv_runs_read" ON public.survey_automation_runs
  FOR SELECT TO authenticated USING (public.sv_can_read());
CREATE POLICY "sv_runs_delete" ON public.survey_automation_runs
  FOR DELETE TO authenticated USING (public.has_role('Super Admin'));

CREATE INDEX idx_sv_auto_runs_rule ON public.survey_automation_runs(rule_id, created_at DESC);
CREATE INDEX idx_sv_auto_runs_source ON public.survey_automation_runs(source_ref);

CREATE TRIGGER trg_sv_rules_touch BEFORE UPDATE ON public.survey_automation_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_sv_runs_touch BEFORE UPDATE ON public.survey_automation_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();