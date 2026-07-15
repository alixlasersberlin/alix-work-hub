
-- 1) Remove catalog_share_links from realtime publication
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='catalog_share_links') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.catalog_share_links';
  END IF;
END $$;

-- 2) esc_calendar_connections: migrate tokens to Vault
ALTER TABLE public.esc_calendar_connections
  ADD COLUMN IF NOT EXISTS access_token_secret_id uuid,
  ADD COLUMN IF NOT EXISTS refresh_token_secret_id uuid;

DO $$
DECLARE r record; sid uuid;
BEGIN
  FOR r IN SELECT id, access_token, refresh_token FROM public.esc_calendar_connections LOOP
    IF r.access_token IS NOT NULL AND length(r.access_token) > 0 THEN
      sid := vault.create_secret(r.access_token, 'esc_cal_access_'||r.id::text, 'esc_calendar_connections.access_token');
      UPDATE public.esc_calendar_connections SET access_token_secret_id = sid WHERE id = r.id;
    END IF;
    IF r.refresh_token IS NOT NULL AND length(r.refresh_token) > 0 THEN
      sid := vault.create_secret(r.refresh_token, 'esc_cal_refresh_'||r.id::text, 'esc_calendar_connections.refresh_token');
      UPDATE public.esc_calendar_connections SET refresh_token_secret_id = sid WHERE id = r.id;
    END IF;
  END LOOP;
END $$;

ALTER TABLE public.esc_calendar_connections
  DROP COLUMN IF EXISTS access_token,
  DROP COLUMN IF EXISTS refresh_token;

-- 3) sms_settings: migrate auth_token to Vault
ALTER TABLE public.sms_settings
  ADD COLUMN IF NOT EXISTS auth_token_secret_id uuid;

DO $$
DECLARE r record; sid uuid;
BEGIN
  FOR r IN SELECT id, auth_token FROM public.sms_settings LOOP
    IF r.auth_token IS NOT NULL AND length(r.auth_token) > 0 THEN
      sid := vault.create_secret(r.auth_token, 'sms_settings_auth_token_'||r.id::text, 'sms_settings.auth_token');
      UPDATE public.sms_settings SET auth_token_secret_id = sid WHERE id = r.id;
    END IF;
  END LOOP;
END $$;

ALTER TABLE public.sms_settings DROP COLUMN IF EXISTS auth_token;

-- 4) mail_domains: migrate api_key to Vault
ALTER TABLE public.mail_domains
  ADD COLUMN IF NOT EXISTS api_key_secret_id uuid;

DO $$
DECLARE r record; sid uuid;
BEGIN
  FOR r IN SELECT id, api_key_encrypted FROM public.mail_domains LOOP
    IF r.api_key_encrypted IS NOT NULL AND length(r.api_key_encrypted) > 0 THEN
      sid := vault.create_secret(r.api_key_encrypted, 'mail_domains_api_key_'||r.id::text, 'mail_domains.api_key');
      UPDATE public.mail_domains SET api_key_secret_id = sid WHERE id = r.id;
    END IF;
  END LOOP;
END $$;

ALTER TABLE public.mail_domains DROP COLUMN IF EXISTS api_key_encrypted;
