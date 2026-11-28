DO $secure_existing_job$
DECLARE
 old_command text;
 new_command text;
 original_schedule text;
 original_active boolean;
 timing_before text;
BEGIN
 SELECT md5(string_agg(jobid::text || ':' || schedule || ':' || active::text,'|' ORDER BY jobid)) INTO timing_before FROM cron.job;
 SELECT command,schedule,active INTO STRICT old_command,original_schedule,original_active FROM cron.job WHERE jobid=72 AND jobname='ac-outreach-engine-hourly';
 IF old_command NOT LIKE '%/functions/v1/ac-outreach-engine%' THEN RAISE EXCEPTION 'Unexpected existing job target'; END IF;
 IF old_command LIKE '%x-cron-secret%' THEN RETURN; END IF;
 IF NOT EXISTS(SELECT 1 FROM vault.decrypted_secrets WHERE name='CRON_SECRET' AND decrypted_secret IS NOT NULL AND decrypted_secret<>'') THEN RAISE EXCEPTION 'Existing private job credential unavailable'; END IF;
 IF old_command !~* 'headers\s*:=\s*''[^'']*''::jsonb' THEN RAISE EXCEPTION 'Unexpected existing header format'; END IF;
 new_command := regexp_replace(old_command,'(headers\s*:=\s*)(''[^'']*''::jsonb)',E'\\1(\\2 || jsonb_build_object(''x-cron-secret'', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name=''CRON_SECRET'' LIMIT 1)))','i');
 IF new_command=old_command THEN RAISE EXCEPTION 'Private caller header was not attached'; END IF;
 PERFORM cron.alter_job(72, command:=new_command);
 IF EXISTS(SELECT 1 FROM cron.job WHERE jobid=72 AND (schedule IS DISTINCT FROM original_schedule OR active IS DISTINCT FROM original_active)) THEN RAISE EXCEPTION 'Schedule or activation changed'; END IF;
 IF timing_before IS DISTINCT FROM (SELECT md5(string_agg(jobid::text || ':' || schedule || ':' || active::text,'|' ORDER BY jobid)) FROM cron.job) THEN RAISE EXCEPTION 'Existing schedule inventory changed'; END IF;
END;
$secure_existing_job$;