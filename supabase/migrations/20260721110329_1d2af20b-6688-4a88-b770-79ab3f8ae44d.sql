
CREATE TABLE public.ac_bot_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  training_phrases JSONB NOT NULL DEFAULT '[]'::jsonb,
  response_template TEXT,
  handoff_to_human BOOLEAN NOT NULL DEFAULT false,
  enabled BOOLEAN NOT NULL DEFAULT true,
  channels TEXT[] NOT NULL DEFAULT ARRAY['web','whatsapp','email']::text[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ac_bot_intents TO authenticated;
GRANT ALL ON public.ac_bot_intents TO service_role;
ALTER TABLE public.ac_bot_intents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage bot intents" ON public.ac_bot_intents FOR ALL TO authenticated
  USING (has_role('Admin') OR has_role('Super Admin')) WITH CHECK (has_role('Admin') OR has_role('Super Admin'));

CREATE TABLE public.ac_bot_flows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  trigger_intent_id UUID REFERENCES public.ac_bot_intents(id) ON DELETE SET NULL,
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  handoff_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT true,
  channels TEXT[] NOT NULL DEFAULT ARRAY['web']::text[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ac_bot_flows TO authenticated;
GRANT ALL ON public.ac_bot_flows TO service_role;
ALTER TABLE public.ac_bot_flows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage bot flows" ON public.ac_bot_flows FOR ALL TO authenticated
  USING (has_role('Admin') OR has_role('Super Admin')) WITH CHECK (has_role('Admin') OR has_role('Super Admin'));

CREATE TABLE public.ac_bot_training_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_id UUID REFERENCES public.ac_bot_intents(id) ON DELETE CASCADE,
  utterance TEXT NOT NULL,
  correct_response TEXT,
  trained_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.ac_bot_training_log TO authenticated;
GRANT ALL ON public.ac_bot_training_log TO service_role;
ALTER TABLE public.ac_bot_training_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage bot training" ON public.ac_bot_training_log FOR ALL TO authenticated
  USING (has_role('Admin') OR has_role('Super Admin')) WITH CHECK (has_role('Admin') OR has_role('Super Admin'));

CREATE TABLE public.ac_voice_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID NOT NULL REFERENCES public.ac_calls(id) ON DELETE CASCADE,
  agent_user_id UUID,
  keywords TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  topics TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  compliance_phrases_found TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  compliance_phrases_missing TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  talk_ratio_agent NUMERIC,
  talk_ratio_customer NUMERIC,
  silence_ratio NUMERIC,
  emotion_agent TEXT,
  emotion_customer TEXT,
  speaker_turns INTEGER,
  language TEXT,
  duration_seconds INTEGER,
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ac_voice_insights_agent ON public.ac_voice_insights(agent_user_id);
CREATE INDEX idx_ac_voice_insights_call ON public.ac_voice_insights(call_id);
GRANT SELECT, INSERT, UPDATE ON public.ac_voice_insights TO authenticated;
GRANT ALL ON public.ac_voice_insights TO service_role;
ALTER TABLE public.ac_voice_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read voice insights" ON public.ac_voice_insights FOR SELECT TO authenticated
  USING (has_role('Admin') OR has_role('Super Admin') OR has_role('QM'));
CREATE POLICY "Admins manage voice insights" ON public.ac_voice_insights FOR ALL TO authenticated
  USING (has_role('Admin') OR has_role('Super Admin')) WITH CHECK (has_role('Admin') OR has_role('Super Admin'));

CREATE TABLE public.ac_voice_compliance_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  required_phrases TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  forbidden_phrases TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  language TEXT NOT NULL DEFAULT 'de',
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ac_voice_compliance_rules TO authenticated;
GRANT ALL ON public.ac_voice_compliance_rules TO service_role;
ALTER TABLE public.ac_voice_compliance_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage compliance rules" ON public.ac_voice_compliance_rules FOR ALL TO authenticated
  USING (has_role('Admin') OR has_role('Super Admin')) WITH CHECK (has_role('Admin') OR has_role('Super Admin'));

CREATE TABLE public.ac_customer_health (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL UNIQUE,
  score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
  usage_score INTEGER,
  payment_score INTEGER,
  support_score INTEGER,
  sentiment_score INTEGER,
  lifecycle_stage TEXT NOT NULL DEFAULT 'onboarding' CHECK (lifecycle_stage IN ('onboarding','adopt','expand','renew','risk','churned')),
  factors JSONB NOT NULL DEFAULT '{}'::jsonb,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ac_customer_health_stage ON public.ac_customer_health(lifecycle_stage);
CREATE INDEX idx_ac_customer_health_score ON public.ac_customer_health(score);
GRANT SELECT ON public.ac_customer_health TO authenticated;
GRANT ALL ON public.ac_customer_health TO service_role;
ALTER TABLE public.ac_customer_health ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read health" ON public.ac_customer_health FOR SELECT TO authenticated
  USING (has_role('Admin') OR has_role('Super Admin') OR has_role('Order') OR has_role('QM'));
CREATE POLICY "Admins manage health" ON public.ac_customer_health FOR ALL TO authenticated
  USING (has_role('Admin') OR has_role('Super Admin')) WITH CHECK (has_role('Admin') OR has_role('Super Admin'));

CREATE TABLE public.ac_lifecycle_playbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage TEXT NOT NULL CHECK (stage IN ('onboarding','adopt','expand','renew','risk','churned')),
  name TEXT NOT NULL,
  description TEXT,
  actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ac_lifecycle_playbooks TO authenticated;
GRANT ALL ON public.ac_lifecycle_playbooks TO service_role;
ALTER TABLE public.ac_lifecycle_playbooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage playbooks" ON public.ac_lifecycle_playbooks FOR ALL TO authenticated
  USING (has_role('Admin') OR has_role('Super Admin')) WITH CHECK (has_role('Admin') OR has_role('Super Admin'));

CREATE TABLE public.ac_lifecycle_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playbook_id UUID REFERENCES public.ac_lifecycle_playbooks(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL,
  stage TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','done','failed','skipped')),
  result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX idx_ac_lifecycle_runs_customer ON public.ac_lifecycle_runs(customer_id);
GRANT SELECT, INSERT, UPDATE ON public.ac_lifecycle_runs TO authenticated;
GRANT ALL ON public.ac_lifecycle_runs TO service_role;
ALTER TABLE public.ac_lifecycle_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage runs" ON public.ac_lifecycle_runs FOR ALL TO authenticated
  USING (has_role('Admin') OR has_role('Super Admin')) WITH CHECK (has_role('Admin') OR has_role('Super Admin'));

CREATE TRIGGER trg_ac_bot_intents_updated BEFORE UPDATE ON public.ac_bot_intents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ac_bot_flows_updated BEFORE UPDATE ON public.ac_bot_flows FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ac_voice_compliance_updated BEFORE UPDATE ON public.ac_voice_compliance_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ac_lifecycle_playbooks_updated BEFORE UPDATE ON public.ac_lifecycle_playbooks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
