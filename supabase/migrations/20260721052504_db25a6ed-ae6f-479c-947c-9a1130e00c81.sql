
CREATE TABLE public.ac_pbx_forwarding_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  condition TEXT NOT NULL DEFAULT 'always' CHECK (condition IN ('always','busy','no_answer','offline','schedule')),
  schedule JSONB NOT NULL DEFAULT '{}'::jsonb,
  destination_type TEXT NOT NULL CHECK (destination_type IN ('extension','mobile','voicemail','queue','external')),
  destination TEXT NOT NULL,
  ring_timeout_seconds INT NOT NULL DEFAULT 20,
  priority INT NOT NULL DEFAULT 100,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ac_pbx_forwarding_rules TO authenticated;
GRANT ALL ON public.ac_pbx_forwarding_rules TO service_role;

ALTER TABLE public.ac_pbx_forwarding_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fwd_select" ON public.ac_pbx_forwarding_rules
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role('Admin') OR public.has_role('Super Admin'));

CREATE POLICY "fwd_insert" ON public.ac_pbx_forwarding_rules
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.has_role('Admin') OR public.has_role('Super Admin'));

CREATE POLICY "fwd_update" ON public.ac_pbx_forwarding_rules
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role('Admin') OR public.has_role('Super Admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role('Admin') OR public.has_role('Super Admin'));

CREATE POLICY "fwd_delete" ON public.ac_pbx_forwarding_rules
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role('Admin') OR public.has_role('Super Admin'));

CREATE INDEX idx_ac_pbx_fwd_user ON public.ac_pbx_forwarding_rules(user_id, enabled, priority);

CREATE TRIGGER trg_ac_pbx_fwd_updated
  BEFORE UPDATE ON public.ac_pbx_forwarding_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
