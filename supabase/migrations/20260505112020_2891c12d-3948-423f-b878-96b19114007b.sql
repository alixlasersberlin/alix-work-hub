-- Remove previous schedule if it exists
do $$
begin
  perform cron.unschedule('zoho-packages-daily');
exception when others then null;
end $$;

select cron.schedule(
  'zoho-packages-daily',
  '32 23 * * *',
  $$
  select net.http_post(
    url := 'https://xmrmkgfgpoundfwhnxfs.supabase.co/functions/v1/sync-zoho-packages',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'CRON_SECRET' limit 1)
    ),
    body := jsonb_build_object('source_system', 'zoho_eu_1')
  );
  $$
);