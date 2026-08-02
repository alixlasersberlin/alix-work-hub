select cron.unschedule('survey-auto-reminders-daily') where exists (select 1 from cron.job where jobname='survey-auto-reminders-daily');
select cron.schedule('survey-auto-reminders-daily','15 8 * * *', $$
  select net.http_post(
    url:='https://xmrmkgfgpoundfwhnxfs.supabase.co/functions/v1/survey-auto-reminders',
    headers:='{"Content-Type":"application/json"}'::jsonb,
    body:='{}'::jsonb
  );
$$);