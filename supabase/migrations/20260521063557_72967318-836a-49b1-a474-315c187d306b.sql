SELECT cron.unschedule(3);
SELECT cron.schedule(
  'nightly-backup',
  '0 22 * * *',
  $$
  SELECT net.http_post(
    url := 'https://xmrmkgfgpoundfwhnxfs.supabase.co/functions/v1/nightly-backup',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'CRON_SECRET' limit 1)
    ),
    body := jsonb_build_object('triggered_at', now())
  ) AS request_id;
  $$
);