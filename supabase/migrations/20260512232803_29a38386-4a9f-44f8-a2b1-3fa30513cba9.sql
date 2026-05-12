
-- Private bucket for backups
INSERT INTO storage.buckets (id, name, public)
VALUES ('backups', 'backups', false)
ON CONFLICT (id) DO NOTHING;

-- Admin-only access
CREATE POLICY "Admins can view backup files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'backups' AND public.is_admin());

CREATE POLICY "Admins can upload backup files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'backups' AND public.is_admin());

CREATE POLICY "Admins can delete backup files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'backups' AND public.is_admin());

-- Add storage_path column to backups_metadata for download
ALTER TABLE public.backups_metadata
  ADD COLUMN IF NOT EXISTS storage_path text,
  ADD COLUMN IF NOT EXISTS file_count integer,
  ADD COLUMN IF NOT EXISTS notify_email text;

-- Enable required extensions for cron
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule weekly backup (Sundays at 03:00 UTC)
DO $$
DECLARE
  existing_jobid bigint;
BEGIN
  SELECT jobid INTO existing_jobid FROM cron.job WHERE jobname = 'weekly-full-backup';
  IF existing_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(existing_jobid);
  END IF;
END $$;

SELECT cron.schedule(
  'weekly-full-backup',
  '0 3 * * 0',
  $$
  SELECT net.http_post(
    url := 'https://xmrmkgfgpoundfwhnxfs.supabase.co/functions/v1/create-full-backup',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.cron_secret', true)
    ),
    body := jsonb_build_object('source', 'cron', 'notify', true)
  ) AS request_id;
  $$
);
