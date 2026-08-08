select cron.unschedule('alix-collect-bank-match-daily');

select cron.schedule(
  'alix-collect-bank-match-daily',
  '50 5 * * *',
  $$
  select net.http_post(
    url:='https://xmrmkgfgpoundfwhnxfs.supabase.co/functions/v1/collect-bank-match',
    headers:='{"Content-Type":"application/json","x-cron-secret":"f51a31027baab1d3ea0e6b560b8b11fea13a8d8638bcd1d1"}'::jsonb,
    body:='{"days":120}'::jsonb
  );
  $$
);

select cron.schedule(
  'alix-collect-device-push-daily',
  '55 5 * * *',
  $$
  select net.http_post(
    url:='https://xmrmkgfgpoundfwhnxfs.supabase.co/functions/v1/collect-device-push',
    headers:='{"Content-Type":"application/json","x-cron-secret":"f51a31027baab1d3ea0e6b560b8b11fea13a8d8638bcd1d1"}'::jsonb,
    body:='{}'::jsonb
  );
  $$
);