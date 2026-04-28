-- Remove any prior schedule with the same name to keep this idempotent
do $$
begin
  if exists (select 1 from cron.job where jobname = 'daily-customer-sync') then
    perform cron.unschedule('daily-customer-sync');
  end if;
end$$;

select cron.schedule(
  'daily-customer-sync',
  '0 3 * * *',
  $$
  select net.http_post(
    url := 'https://xmrmkgfgpoundfwhnxfs.supabase.co/functions/v1/scheduled-customer-sync',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhtcm1rZ2ZncG91bmRmd2hueGZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxNDAwNjMsImV4cCI6MjA5MTcxNjA2M30.pooQ-fUWvILgv-uV65CyxHvcmeUMUvO959SnpO2LpaA"}'::jsonb,
    body := jsonb_build_object('source_system','zoho_eu_1','triggered_at', now())
  );
  $$
);