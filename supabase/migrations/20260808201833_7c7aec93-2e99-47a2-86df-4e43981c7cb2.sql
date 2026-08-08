select cron.unschedule('offers-ai-autoscore-daily') where exists (select 1 from cron.job where jobname = 'offers-ai-autoscore-daily');

select cron.schedule(
  'offers-ai-autoscore-daily',
  '20 5 * * *',
  $$
  select net.http_post(
    url:='https://xmrmkgfgpoundfwhnxfs.supabase.co/functions/v1/offers-ai-autoscore',
    headers:='{"Content-Type":"application/json"}'::jsonb,
    body:='{"limit":100,"stale_days":7}'::jsonb
  );
  $$
);