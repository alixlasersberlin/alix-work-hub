select cron.unschedule('fleet-maintenance-alerts-daily') where exists (select 1 from cron.job where jobname='fleet-maintenance-alerts-daily');
select cron.unschedule('delivery-rating-report-monthly') where exists (select 1 from cron.job where jobname='delivery-rating-report-monthly');

select cron.schedule(
  'fleet-maintenance-alerts-daily',
  '10 6 * * *',
  $$
  select net.http_post(
    url:='https://xmrmkgfgpoundfwhnxfs.supabase.co/functions/v1/fleet-maintenance-alerts',
    headers:='{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhtcm1rZ2ZncG91bmRmd2hueGZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxNDAwNjMsImV4cCI6MjA5MTcxNjA2M30.pooQ-fUWvILgv-uV65CyxHvcmeUMUvO959SnpO2LpaA"}'::jsonb,
    body:='{"source":"cron"}'::jsonb
  ) as request_id;
  $$
);

select cron.schedule(
  'delivery-rating-report-monthly',
  '20 5 1 * *',
  $$
  select net.http_post(
    url:='https://xmrmkgfgpoundfwhnxfs.supabase.co/functions/v1/delivery-rating-report',
    headers:='{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhtcm1rZ2ZncG91bmRmd2hueGZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxNDAwNjMsImV4cCI6MjA5MTcxNjA2M30.pooQ-fUWvILgv-uV65CyxHvcmeUMUvO959SnpO2LpaA"}'::jsonb,
    body:='{"source":"cron"}'::jsonb
  ) as request_id;
  $$
);