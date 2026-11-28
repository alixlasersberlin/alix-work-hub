DO $backup_restart$
DECLARE
  existing_command text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('alixwork:manual-full-backup-start'));
  IF EXISTS (SELECT 1 FROM public.backups_metadata WHERE backup_status = 'running' AND backup_scope = 'full') THEN
    RAISE NOTICE 'Eine Vollsicherung läuft bereits; kein zweiter Start.';
    RETURN;
  END IF;
  SELECT command INTO existing_command FROM cron.job
    WHERE jobid = 10 AND jobname = 'daily-full-backup' AND active = true
      AND command ILIKE '%create-full-backup%';
  IF existing_command IS NULL THEN
    RAISE EXCEPTION 'Bestehender automatischer Vollsicherungsauftrag nicht gefunden.';
  END IF;
  EXECUTE existing_command;
END;
$backup_restart$;