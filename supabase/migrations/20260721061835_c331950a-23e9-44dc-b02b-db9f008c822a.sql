
-- Phase 24: Omnichannel Routing 2.0, AI Copilot, Quality Management

-- Agent skills (per user)
CREATE TABLE public.ac_agent_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  skill text NOT NULL,
  proficiency int NOT NULL DEFAULT 3 CHECK (proficiency BETWEEN 1 AND 5),
  languages text[] DEFAULT '{}',
  max_concurrent int DEFAULT 3,
  is_available boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, skill)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ac_agent_skills TO authenticated;
GRANT ALL ON public.ac_agent_skills TO service_role;
ALTER TABLE public.ac_agent_skills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage skills" ON public.ac_agent_skills FOR ALL TO authenticated
  USING (public.has_role('Admin') OR public.has_role('Super Admin'))
  WITH CHECK (public.has_role('Admin') OR public.has_role('Super Admin'));
CREATE POLICY "Users read own skills" ON public.ac_agent_skills FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role('Admin') OR public.has_role('Super Admin'));

-- Routing rules (SLA + skill + overflow across channels)
CREATE TABLE public.ac_routing_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('call','chat','email','whatsapp','sms','ticket','any')),
  priority int NOT NULL DEFAULT 100,
  is_active boolean DEFAULT true,
  match_conditions jsonb NOT NULL DEFAULT '{}'::jsonb,
  required_skills text[] DEFAULT '{}',
  required_language text,
  min_customer_score int,
  target_queue_id uuid,
  target_user_ids uuid[] DEFAULT '{}',
  sla_first_response_sec int,
  sla_resolution_sec int,
  overflow_after_sec int,
  overflow_target_queue_id uuid,
  overflow_target_user_ids uuid[] DEFAULT '{}',
  boost_by_customer_score boolean DEFAULT true,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ac_routing_rules TO authenticated;
GRANT ALL ON public.ac_routing_rules TO service_role;
ALTER TABLE public.ac_routing_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage routing" ON public.ac_routing_rules FOR ALL TO authenticated
  USING (public.has_role('Admin') OR public.has_role('Super Admin'))
  WITH CHECK (public.has_role('Admin') OR public.has_role('Super Admin'));
CREATE POLICY "Staff read routing" ON public.ac_routing_rules FOR SELECT TO authenticated USING (true);

-- Routing decision log (audit)
CREATE TABLE public.ac_routing_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid,
  channel text,
  source_id uuid,
  source_type text,
  chosen_user_id uuid,
  chosen_queue_id uuid,
  reason text,
  score numeric,
  fallback_used boolean DEFAULT false,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);
GRANT SELECT ON public.ac_routing_decisions TO authenticated;
GRANT ALL ON public.ac_routing_decisions TO service_role;
ALTER TABLE public.ac_routing_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read decisions" ON public.ac_routing_decisions FOR SELECT TO authenticated
  USING (public.has_role('Admin') OR public.has_role('Super Admin'));

-- QM scorecards (criteria templates)
CREATE TABLE public.ac_qm_scorecards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  channel text NOT NULL DEFAULT 'call',
  criteria jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{key,label,weight,max_score,description}]
  is_active boolean DEFAULT true,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ac_qm_scorecards TO authenticated;
GRANT ALL ON public.ac_qm_scorecards TO service_role;
ALTER TABLE public.ac_qm_scorecards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage scorecards" ON public.ac_qm_scorecards FOR ALL TO authenticated
  USING (public.has_role('Admin') OR public.has_role('Super Admin'))
  WITH CHECK (public.has_role('Admin') OR public.has_role('Super Admin'));
CREATE POLICY "Staff read scorecards" ON public.ac_qm_scorecards FOR SELECT TO authenticated USING (true);

-- QM evaluations (a scored interaction)
CREATE TABLE public.ac_qm_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scorecard_id uuid NOT NULL REFERENCES public.ac_qm_scorecards(id) ON DELETE RESTRICT,
  call_id uuid,
  conversation_id uuid,
  agent_user_id uuid,
  evaluator_user_id uuid,
  scores jsonb NOT NULL DEFAULT '{}'::jsonb, -- {criterion_key: score}
  weighted_total numeric,
  max_possible numeric,
  percent numeric,
  notes text,
  ai_generated boolean DEFAULT false,
  status text DEFAULT 'draft' CHECK (status IN ('draft','completed','calibrated')),
  coaching_required boolean DEFAULT false,
  coaching_notes text,
  coaching_done_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ac_qm_evaluations TO authenticated;
GRANT ALL ON public.ac_qm_evaluations TO service_role;
ALTER TABLE public.ac_qm_evaluations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage evals" ON public.ac_qm_evaluations FOR ALL TO authenticated
  USING (public.has_role('Admin') OR public.has_role('Super Admin'))
  WITH CHECK (public.has_role('Admin') OR public.has_role('Super Admin'));
CREATE POLICY "Agents read own evals" ON public.ac_qm_evaluations FOR SELECT TO authenticated
  USING (agent_user_id = auth.uid() OR evaluator_user_id = auth.uid() OR public.has_role('Admin') OR public.has_role('Super Admin'));

-- Copilot suggestions log (for analytics + caching)
CREATE TABLE public.ac_copilot_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  context_type text NOT NULL, -- call, chat, ticket, email
  context_id uuid,
  input_snippet text,
  suggestion_type text NOT NULL, -- next_reply, kb_snippet, autocomplete, translate, summary
  content text NOT NULL,
  kb_source text,
  model text,
  latency_ms int,
  accepted boolean,
  created_at timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ac_copilot_suggestions TO authenticated;
GRANT ALL ON public.ac_copilot_suggestions TO service_role;
ALTER TABLE public.ac_copilot_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own copilot" ON public.ac_copilot_suggestions FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.has_role('Admin') OR public.has_role('Super Admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role('Admin') OR public.has_role('Super Admin'));

-- updated_at triggers
CREATE TRIGGER trg_ac_agent_skills_upd BEFORE UPDATE ON public.ac_agent_skills FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ac_routing_rules_upd BEFORE UPDATE ON public.ac_routing_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ac_qm_scorecards_upd BEFORE UPDATE ON public.ac_qm_scorecards FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ac_qm_evaluations_upd BEFORE UPDATE ON public.ac_qm_evaluations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
