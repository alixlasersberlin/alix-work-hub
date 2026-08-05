select cron.unschedule('license-royalty-monthly') where exists (select 1 from cron.job where jobname='license-royalty-monthly');

select cron.schedule(
  'license-royalty-monthly',
  '20 4 3 * *',
  $$
  select net.http_post(
    url:='https://xmrmkgfgpoundfwhnxfs.supabase.co/functions/v1/license-royalty-run',
    headers:='{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhtcm1rZ2ZncG91bmRmd2hueGZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxNDAwNjMsImV4cCI6MjA5MTcxNjA2M30.pooQ-fUWvILgv-uV65CyxHvcmeUMUvO959SnpO2LpaA"}'::jsonb,
    body:='{"source":"cron"}'::jsonb
  ) as request_id;
  $$
);