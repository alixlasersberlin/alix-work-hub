
CREATE TABLE public.ac_sla_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  channel TEXT,
  priority TEXT,
  first_response_min INT NOT NULL DEFAULT 60,
  resolution_min INT NOT NULL DEFAULT 1440,
  business_hours_only BOOLEAN NOT NULL DEFAULT false,
  escalate_to UUID,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ac_sla_policies TO authenticated;
GRANT ALL ON public.ac_sla_policies TO service_role;
ALTER TABLE public.ac_sla_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sla_policies_admin_all" ON public.ac_sla_policies FOR ALL TO authenticated
  USING (public.has_role('Admin') OR public.has_role('Super Admin'))
  WITH CHECK (public.has_role('Admin') OR public.has_role('Super Admin'));

CREATE TABLE public.ac_sla_breaches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id UUID REFERENCES public.ac_sla_policies(id) ON DELETE SET NULL,
  conversation_id UUID,
  breach_type TEXT NOT NULL,
  breached_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  notified BOOLEAN NOT NULL DEFAULT false,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ac_sla_breaches TO authenticated;
GRANT ALL ON public.ac_sla_breaches TO service_role;
ALTER TABLE public.ac_sla_breaches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sla_breaches_admin_read" ON public.ac_sla_breaches FOR SELECT TO authenticated
  USING (public.has_role('Admin') OR public.has_role('Super Admin'));
CREATE INDEX ix_sla_breaches_conv ON public.ac_sla_breaches(conversation_id);
CREATE INDEX ix_sla_breaches_unresolved ON public.ac_sla_breaches(resolved_at) WHERE resolved_at IS NULL;

CREATE TABLE public.ac_copilot_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid(),
  action_type TEXT NOT NULL,
  params JSONB NOT NULL DEFAULT '{}'::jsonb,
  result JSONB,
  status TEXT NOT NULL DEFAULT 'success',
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.ac_copilot_actions TO authenticated;
GRANT ALL ON public.ac_copilot_actions TO service_role;
ALTER TABLE public.ac_copilot_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "copilot_actions_own_read" ON public.ac_copilot_actions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role('Admin') OR public.has_role('Super Admin'));
CREATE POLICY "copilot_actions_insert_self" ON public.ac_copilot_actions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE INDEX ix_copilot_actions_user ON public.ac_copilot_actions(user_id, created_at DESC);
