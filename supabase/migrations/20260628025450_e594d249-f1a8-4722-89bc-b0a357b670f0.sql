
SELECT cron.schedule(
  'hetzner-sync-nightly',
  '30 22 * * *',
  $$
  SELECT net.http_post(
    url := 'https://xmrmkgfgpoundfwhnxfs.supabase.co/functions/v1/sync-backup-to-hetzner',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET' LIMIT 1)
    ),
    body := jsonb_build_object('source', 'cron', 'mirror_buckets', true)
  ) AS request_id;
  $$
);

SELECT cron.schedule(
  'hetzner-sync-midday',
  '30 10 * * *',
  $$
  SELECT net.http_post(
    url := 'https://xmrmkgfgpoundfwhnxfs.supabase.co/functions/v1/sync-backup-to-hetzner',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET' LIMIT 1)
    ),
    body := jsonb_build_object('source', 'cron', 'mirror_buckets', true)
  ) AS request_id;
  $$
);

-- Sofortige Aufhol-Sicherung anstoßen
SELECT net.http_post(
  url := 'https://xmrmkgfgpoundfwhnxfs.supabase.co/functions/v1/sync-backup-to-hetzner',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET' LIMIT 1)
  ),
  body := jsonb_build_object('source', 'manual-catchup', 'mirror_buckets', true)
);
