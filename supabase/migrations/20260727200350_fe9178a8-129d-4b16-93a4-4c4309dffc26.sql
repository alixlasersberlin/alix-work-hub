SELECT cron.schedule(
  'audit-alert-digest-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url:='https://xmrmkgfgpoundfwhnxfs.supabase.co/functions/v1/audit-alert-digest',
    headers:='{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhtcm1rZ2ZncG91bmRmd2hueGZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxNDAwNjMsImV4cCI6MjA5MTcxNjA2M30.pooQ-fUWvILgv-uV65CyxHvcmeUMUvO959SnpO2LpaA"}'::jsonb,
    body:=concat('{"ts":"', now(), '"}')::jsonb
  );
  $$
);