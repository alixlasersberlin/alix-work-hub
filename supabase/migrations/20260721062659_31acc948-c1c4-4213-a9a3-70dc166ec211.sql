
CREATE TABLE public.ac_qm_calibration_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  scorecard_id UUID REFERENCES public.ac_qm_scorecards(id) ON DELETE SET NULL,
  call_id UUID REFERENCES public.ac_calls(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES public.ac_conversations(id) ON DELETE SET NULL,
  target_variance NUMERIC DEFAULT 10,
  status TEXT NOT NULL DEFAULT 'open',
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ac_qm_calibration_sessions TO authenticated;
GRANT ALL ON public.ac_qm_calibration_sessions TO service_role;
ALTER TABLE public.ac_qm_calibration_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "QM staff manage calibration sessions"
  ON public.ac_qm_calibration_sessions FOR ALL
  USING (public.has_role('Super Admin') OR public.has_role('Admin') OR public.has_role('QM'))
  WITH CHECK (public.has_role('Super Admin') OR public.has_role('Admin') OR public.has_role('QM'));

CREATE TABLE public.ac_qm_calibration_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.ac_qm_calibration_sessions(id) ON DELETE CASCADE,
  rater_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score NUMERIC NOT NULL,
  breakdown JSONB DEFAULT '{}'::jsonb,
  comment TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, rater_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ac_qm_calibration_scores TO authenticated;
GRANT ALL ON public.ac_qm_calibration_scores TO service_role;
ALTER TABLE public.ac_qm_calibration_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "QM staff manage calibration scores"
  ON public.ac_qm_calibration_scores FOR ALL
  USING (public.has_role('Super Admin') OR public.has_role('Admin') OR public.has_role('QM'))
  WITH CHECK (public.has_role('Super Admin') OR public.has_role('Admin') OR public.has_role('QM'));

CREATE TABLE public.ac_qm_coaching_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  coach_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  evaluation_id UUID REFERENCES public.ac_qm_evaluations(id) ON DELETE SET NULL,
  scheduled_at TIMESTAMPTZ,
  duration_min INT DEFAULT 30,
  topics TEXT[],
  strengths TEXT,
  improvements TEXT,
  actions JSONB DEFAULT '[]'::jsonb,
  followup_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'scheduled',
  agent_signed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ac_qm_coaching_sessions TO authenticated;
GRANT ALL ON public.ac_qm_coaching_sessions TO service_role;
ALTER TABLE public.ac_qm_coaching_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "QM staff manage coaching"
  ON public.ac_qm_coaching_sessions FOR ALL
  USING (public.has_role('Super Admin') OR public.has_role('Admin') OR public.has_role('QM'))
  WITH CHECK (public.has_role('Super Admin') OR public.has_role('Admin') OR public.has_role('QM'));
CREATE POLICY "Agents view own coaching"
  ON public.ac_qm_coaching_sessions FOR SELECT
  USING (agent_id = auth.uid());
CREATE POLICY "Agents sign own coaching"
  ON public.ac_qm_coaching_sessions FOR UPDATE
  USING (agent_id = auth.uid())
  WITH CHECK (agent_id = auth.uid());

CREATE TABLE public.ac_routing_simulations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  input_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  rules_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
  result JSONB NOT NULL DEFAULT '{}'::jsonb,
  matched_rule_id UUID,
  assigned_agent_id UUID,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ac_routing_simulations TO authenticated;
GRANT ALL ON public.ac_routing_simulations TO service_role;
ALTER TABLE public.ac_routing_simulations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage routing simulations"
  ON public.ac_routing_simulations FOR ALL
  USING (public.has_role('Super Admin') OR public.has_role('Admin'))
  WITH CHECK (public.has_role('Super Admin') OR public.has_role('Admin'));

CREATE TRIGGER trg_ac_qm_calibration_sessions_updated
  BEFORE UPDATE ON public.ac_qm_calibration_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ac_qm_coaching_sessions_updated
  BEFORE UPDATE ON public.ac_qm_coaching_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_ac_qm_coaching_agent ON public.ac_qm_coaching_sessions(agent_id, scheduled_at DESC);
CREATE INDEX idx_ac_qm_calibration_scores_session ON public.ac_qm_calibration_scores(session_id);
CREATE INDEX idx_ac_routing_simulations_created ON public.ac_routing_simulations(created_at DESC);
