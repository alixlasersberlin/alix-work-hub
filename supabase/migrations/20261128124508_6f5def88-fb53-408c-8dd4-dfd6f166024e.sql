DO $security_backup_start$
DECLARE
  v_command text;
  v_before text;
  v_after text;
BEGIN
  IF NOT pg_try_advisory_xact_lock(hashtext('security-final-full-backup-start')) THEN
    RAISE EXCEPTION 'Backup start already being processed';
  END IF;
  IF EXISTS (SELECT 1 FROM public.backups_metadata WHERE backup_status='running') THEN
    RAISE EXCEPTION 'An existing backup is running; no duplicate start';
  END IF;
  SELECT md5(string_agg(jsonb_build_object('id',jobid,'schedule',schedule,'active',active,'command_hash',md5(command))::text,'' ORDER BY jobid)) INTO v_before FROM cron.job;
  SELECT command INTO STRICT v_command FROM cron.job WHERE jobname='daily-full-backup' AND active=true;
  IF v_command NOT ILIKE '%create-full-backup%' THEN RAISE EXCEPTION 'Unexpected backup job target'; END IF;
  EXECUTE v_command;
  SELECT md5(string_agg(jsonb_build_object('id',jobid,'schedule',schedule,'active',active,'command_hash',md5(command))::text,'' ORDER BY jobid)) INTO v_after FROM cron.job;
  IF v_before IS DISTINCT FROM v_after THEN RAISE EXCEPTION 'Scheduler configuration changed unexpectedly'; END IF;
END
$security_backup_start$;