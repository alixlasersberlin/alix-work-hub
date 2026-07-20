
CREATE TABLE IF NOT EXISTS public.ac_automation_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID,
  name TEXT NOT NULL,
  trigger TEXT NOT NULL CHECK (trigger IN ('message.received','conversation.created','sla.breached','keyword.matched')),
  channel TEXT NOT NULL DEFAULT 'any',
  keyword TEXT,
  action TEXT NOT NULL CHECK (action IN ('auto_reply','assign','tag','escalate','webhook')),
  action_value TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  run_count INTEGER NOT NULL DEFAULT 0,
  last_run_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ac_automation_rules TO authenticated;
GRANT ALL ON public.ac_automation_rules TO service_role;
ALTER TABLE public.ac_automation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ac_automation_rules admin manage" ON public.ac_automation_rules
  FOR ALL TO authenticated
  USING (public.has_role('Admin') OR public.has_role('Super Admin'))
  WITH CHECK (public.has_role('Admin') OR public.has_role('Super Admin'));

CREATE TABLE IF NOT EXISTS public.ac_automation_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rule_id UUID REFERENCES public.ac_automation_rules(id) ON DELETE CASCADE,
  conversation_id UUID,
  message_id UUID,
  action TEXT NOT NULL,
  status TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ac_automation_runs TO authenticated;
GRANT ALL ON public.ac_automation_runs TO service_role;
ALTER TABLE public.ac_automation_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ac_automation_runs admin read" ON public.ac_automation_runs
  FOR SELECT TO authenticated
  USING (public.has_role('Admin') OR public.has_role('Super Admin'));

CREATE INDEX IF NOT EXISTS idx_ac_automation_rules_active ON public.ac_automation_rules(active, trigger);
CREATE INDEX IF NOT EXISTS idx_ac_automation_runs_rule ON public.ac_automation_runs(rule_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.tg_ac_automation_rules_touch()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path=public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS trg_ac_automation_rules_touch ON public.ac_automation_rules;
CREATE TRIGGER trg_ac_automation_rules_touch BEFORE UPDATE ON public.ac_automation_rules
  FOR EACH ROW EXECUTE FUNCTION public.tg_ac_automation_rules_touch();

CREATE OR REPLACE FUNCTION public.tg_ac_messages_automation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_url TEXT := 'https://xmrmkgfgpoundfwhnxfs.supabase.co/functions/v1/ac-automation-run';
  v_anon TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhtcm1rZ2ZncG91bmRmd2hueGZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxNDAwNjMsImV4cCI6MjA5MTcxNjA2M30.pooQ-fUWvILgv-uV65CyxHvcmeUMUvO959SnpO2LpaA';
BEGIN
  IF NEW.direction::text = 'inbound' AND COALESCE(NEW.is_internal_note, false) = false THEN
    PERFORM net.http_post(
      url := v_url,
      headers := jsonb_build_object('Content-Type','application/json','apikey', v_anon, 'Authorization', 'Bearer ' || v_anon),
      body := jsonb_build_object('event','message.received','message_id', NEW.id, 'conversation_id', NEW.conversation_id, 'body', NEW.body, 'channel_id', NEW.channel_id, 'tenant_id', NEW.tenant_id)
    );
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_ac_messages_automation ON public.ac_messages;
CREATE TRIGGER trg_ac_messages_automation AFTER INSERT ON public.ac_messages
  FOR EACH ROW EXECUTE FUNCTION public.tg_ac_messages_automation();
