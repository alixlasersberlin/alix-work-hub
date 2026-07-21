
CREATE TABLE IF NOT EXISTS public.ac_pbx_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  pbx_url text,
  api_token text,
  extension text,
  webhook_secret text,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ac_pbx_settings TO authenticated;
GRANT ALL ON public.ac_pbx_settings TO service_role;
ALTER TABLE public.ac_pbx_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pbx settings admin only" ON public.ac_pbx_settings FOR ALL TO authenticated
  USING (public.has_role('Admin') OR public.has_role('Super Admin'))
  WITH CHECK (public.has_role('Admin') OR public.has_role('Super Admin'));

CREATE TABLE IF NOT EXISTS public.ac_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  direction text NOT NULL CHECK (direction IN ('inbound','outbound')),
  status text NOT NULL DEFAULT 'ringing' CHECK (status IN ('ringing','answered','missed','ended','voicemail','busy','failed')),
  from_number text,
  to_number text,
  extension text,
  agent_user_id uuid,
  contact_id uuid,
  conversation_id uuid,
  external_call_id text UNIQUE,
  started_at timestamptz NOT NULL DEFAULT now(),
  answered_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer,
  recording_url text,
  voicemail_url text,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ac_calls TO authenticated;
GRANT ALL ON public.ac_calls TO service_role;
ALTER TABLE public.ac_calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "calls read internal" ON public.ac_calls FOR SELECT TO authenticated
  USING (
    public.has_role('Admin') OR public.has_role('Super Admin')
    OR agent_user_id = auth.uid()
    OR public.has_role('Kundenservice')
    OR public.has_role('Vertrieb')
  );
CREATE POLICY "calls insert internal" ON public.ac_calls FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "calls update own or admin" ON public.ac_calls FOR UPDATE TO authenticated
  USING (agent_user_id = auth.uid() OR public.has_role('Admin') OR public.has_role('Super Admin'));
CREATE POLICY "calls delete super admin" ON public.ac_calls FOR DELETE TO authenticated
  USING (public.has_role('Super Admin'));

CREATE INDEX IF NOT EXISTS idx_ac_calls_started ON public.ac_calls (started_at DESC);
CREATE INDEX IF NOT EXISTS idx_ac_calls_agent ON public.ac_calls (agent_user_id);
CREATE INDEX IF NOT EXISTS idx_ac_calls_contact ON public.ac_calls (contact_id);

CREATE TRIGGER trg_ac_calls_updated BEFORE UPDATE ON public.ac_calls
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ac_pbx_updated BEFORE UPDATE ON public.ac_pbx_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.ac_calls;
ALTER TABLE public.ac_calls REPLICA IDENTITY FULL;
