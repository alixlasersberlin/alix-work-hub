-- Store CRON_SECRET in vault (must match Edge Function CRON_SECRET)
SELECT vault.create_secret(
  'a7f3e9c2-8b4d-4f1a-9e6c-2d5b8a1f7c3e-alix-2026',
  'CRON_SECRET',
  'Shared bearer token for scheduled backup edge functions'
);

-- Remove old cron jobs
SELECT cron.unschedule(8);
SELECT cron.unschedule(9);

-- Daily full backup at 22:00 → create-full-backup (with Hetzner sync)
SELECT cron.schedule(
  'daily-full-backup',
  '0 22 * * *',
  $$
  SELECT net.http_post(
    url := 'https://xmrmkgfgpoundfwhnxfs.supabase.co/functions/v1/create-full-backup',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET' LIMIT 1)
    ),
    body := jsonb_build_object('source', 'cron', 'notify', false, 'scope', 'full')
  ) AS request_id;
  $$
);

-- Weekly full backup with email notify, Sunday 03:00
SELECT cron.schedule(
  'weekly-full-backup',
  '0 3 * * 0',
  $$
  SELECT net.http_post(
    url := 'https://xmrmkgfgpoundfwhnxfs.supabase.co/functions/v1/create-full-backup',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET' LIMIT 1)
    ),
    body := jsonb_build_object('source', 'cron', 'notify', true, 'notify_email', 'rde@alix-lasers.com', 'scope', 'full')
  ) AS request_id;
  $$
);