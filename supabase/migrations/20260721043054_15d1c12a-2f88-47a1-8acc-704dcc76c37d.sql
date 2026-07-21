CREATE OR REPLACE FUNCTION public.backup_watchdog_mark_stuck()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.backups_metadata
  SET backup_status = 'failed',
      completed_at = COALESCE(completed_at, now()),
      message = COALESCE(message, '') || ' [watchdog: auto-failed nach > 2h im Status running]'
  WHERE backup_status = 'running'
    AND started_at < now() - interval '2 hours';
$$;

-- Alten Job entfernen, falls vorhanden, dann neu einplanen (alle 30 Min).
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'backup-watchdog-stuck';

SELECT cron.schedule(
  'backup-watchdog-stuck',
  '*/30 * * * *',
  $$ SELECT public.backup_watchdog_mark_stuck(); $$
);