DO $secure_existing_callers$
DECLARE
 j record;
 next_command text;
 original_timing text;
BEGIN
 SELECT md5(string_agg(jobid::text || ':' || schedule || ':' || active::text,'|' ORDER BY jobid)) INTO original_timing FROM cron.job;
 IF NOT EXISTS(SELECT 1 FROM vault.decrypted_secrets WHERE name='CRON_SECRET' AND decrypted_secret IS NOT NULL AND decrypted_secret<>'') THEN RAISE EXCEPTION 'Existing private caller credential unavailable'; END IF;
 FOR j IN SELECT jobid,jobname,command FROM cron.job WHERE (jobid=42 AND jobname='ticket-auto-close-daily') OR (jobid=74 AND jobname='ac-voice-analyze-hourly') LOOP
  IF j.command LIKE '%x-cron-secret%' THEN CONTINUE; END IF;
  IF j.command !~* 'headers\s*:=\s*''[^'']*''::jsonb' THEN RAISE EXCEPTION 'Existing header format unsupported'; END IF;
  next_command := regexp_replace(j.command,'(headers\s*:=\s*)(''[^'']*''::jsonb)',E'\\1(\\2 || jsonb_build_object(''x-cron-secret'', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name=''CRON_SECRET'' LIMIT 1)))','i');
  IF next_command=j.command THEN RAISE EXCEPTION 'Private header was not added'; END IF;
  PERFORM cron.alter_job(j.jobid,command:=next_command);
 END LOOP;
 IF original_timing IS DISTINCT FROM (SELECT md5(string_agg(jobid::text || ':' || schedule || ':' || active::text,'|' ORDER BY jobid)) FROM cron.job) THEN RAISE EXCEPTION 'Existing schedule or activation changed'; END IF;
END;
$secure_existing_callers$;