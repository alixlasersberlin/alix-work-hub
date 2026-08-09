select cron.unschedule('delivery-approval-escalation') where exists (select 1 from cron.job where jobname = 'delivery-approval-escalation');

select cron.schedule(
  'delivery-approval-escalation',
  '15 * * * *',
  $$
  select net.http_post(
    url := 'https://xmrmkgfgpoundfwhnxfs.supabase.co/functions/v1/delivery-approval-escalation',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);