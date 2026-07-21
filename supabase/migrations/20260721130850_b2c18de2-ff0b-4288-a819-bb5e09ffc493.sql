
ALTER TABLE public.ac_lifecycle_playbooks
  ADD COLUMN IF NOT EXISTS throttle_days integer NOT NULL DEFAULT 14,
  ADD COLUMN IF NOT EXISTS min_score integer,
  ADD COLUMN IF NOT EXISTS max_score integer;

CREATE INDEX IF NOT EXISTS idx_ac_lifecycle_runs_customer_playbook
  ON public.ac_lifecycle_runs(playbook_id, customer_id, created_at DESC);

-- Ensure pg_cron & pg_net exist
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  PERFORM cron.unschedule('ac-playbook-run-hourly');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'ac-playbook-run-hourly',
  '15 * * * *',
  $$
  SELECT net.http_post(
    url:='https://xmrmkgfgpoundfwhnxfs.supabase.co/functions/v1/ac-playbook-run',
    headers:='{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhtcm1rZ2ZncG91bmRmd2hueGZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxNDAwNjMsImV4cCI6MjA5MTcxNjA2M30.pooQ-fUWvILgv-uV65CyxHvcmeUMUvO959SnpO2LpaA"}'::jsonb,
    body:=concat('{"scheduled_at":"', now(), '"}')::jsonb
  );
  $$
);
