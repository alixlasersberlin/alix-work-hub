select cron.unschedule('alix-collect-bank-match-daily') where exists (select 1 from cron.job where jobname = 'alix-collect-bank-match-daily');

select cron.schedule(
  'alix-collect-bank-match-daily',
  '50 5 * * *',
  $$
  select net.http_post(
    url:='https://xmrmkgfgpoundfwhnxfs.supabase.co/functions/v1/collect-bank-match',
    headers:=jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body:='{"days":120}'::jsonb
  );
  $$
);