
ALTER TABLE public.finance_contracts
  ADD COLUMN IF NOT EXISTS signature_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS signature_last_reminder_at timestamptz,
  ADD COLUMN IF NOT EXISTS signature_reminder_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS signature_reminder_max integer NOT NULL DEFAULT 3;

CREATE INDEX IF NOT EXISTS idx_finance_contracts_sig_pending
  ON public.finance_contracts(signature_status, signature_requested_at)
  WHERE customer_visible = true AND signature_status IN ('requested','pending');

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  PERFORM cron.unschedule('portal-contract-reminders-hourly');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'portal-contract-reminders-hourly',
  '25 * * * *',
  $$
  SELECT net.http_post(
    url:='https://xmrmkgfgpoundfwhnxfs.supabase.co/functions/v1/portal-contract-reminders',
    headers:='{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhtcm1rZ2ZncG91bmRmd2hueGZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxNDAwNjMsImV4cCI6MjA5MTcxNjA2M30.pooQ-fUWvILgv-uV65CyxHvcmeUMUvO959SnpO2LpaA"}'::jsonb,
    body:=concat('{"scheduled_at":"', now(), '"}')::jsonb
  );
  $$
);
