
-- Extensions (idempotent)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Trigger function: fire automation on new conversation
CREATE OR REPLACE FUNCTION public.tg_ac_conv_automation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  fn_url text := 'https://xmrmkgfgpoundfwhnxfs.supabase.co/functions/v1/ac-automation-run';
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhtcm1rZ2ZncG91bmRmd2hueGZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxNDAwNjMsImV4cCI6MjA5MTcxNjA2M30.pooQ-fUWvILgv-uV65CyxHvcmeUMUvO959SnpO2LpaA';
BEGIN
  PERFORM net.http_post(
    url := fn_url,
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||anon_key,'apikey',anon_key),
    body := jsonb_build_object(
      'event','conversation.created',
      'conversation_id', NEW.id,
      'tenant_id', NEW.tenant_id
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ac_conv_automation ON public.ac_conversations;
CREATE TRIGGER trg_ac_conv_automation
AFTER INSERT ON public.ac_conversations
FOR EACH ROW EXECUTE FUNCTION public.tg_ac_conv_automation();

-- SLA cron: every 5 minutes
SELECT cron.unschedule('ac-sla-check-every-5m') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'ac-sla-check-every-5m'
);

SELECT cron.schedule(
  'ac-sla-check-every-5m',
  '*/5 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://xmrmkgfgpoundfwhnxfs.supabase.co/functions/v1/ac-sla-check',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhtcm1rZ2ZncG91bmRmd2hueGZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxNDAwNjMsImV4cCI6MjA5MTcxNjA2M30.pooQ-fUWvILgv-uV65CyxHvcmeUMUvO959SnpO2LpaA',
      'apikey','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhtcm1rZ2ZncG91bmRmd2hueGZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxNDAwNjMsImV4cCI6MjA5MTcxNjA2M30.pooQ-fUWvILgv-uV65CyxHvcmeUMUvO959SnpO2LpaA'
    ),
    body := jsonb_build_object('time', now())
  );
  $cron$
);
