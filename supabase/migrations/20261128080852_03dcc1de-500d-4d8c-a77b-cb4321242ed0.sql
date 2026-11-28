DO $migration$
DECLARE j record; secured text; before_schedule text;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM vault.decrypted_secrets WHERE name='CRON_SECRET' AND decrypted_secret IS NOT NULL AND decrypted_secret<>'') THEN RAISE EXCEPTION 'Existing scheduler credential unavailable'; END IF;
 SELECT md5(string_agg(jsonb_build_object('id',jobid,'name',jobname,'schedule',schedule,'active',active)::text,'' ORDER BY jobid)) INTO before_schedule FROM cron.job;
 SELECT jobid, command INTO STRICT j FROM cron.job WHERE jobid=48 AND command LIKE '%/functions/v1/security-alert-notify%';
 IF j.command ~* 'headers\s*:?=\s*''[^'']*''::jsonb' THEN
  secured:=regexp_replace(j.command,'headers\s*:?=\s*''[^'']*''::jsonb','headers := jsonb_build_object(''Content-Type'',''application/json'',''Authorization'',''Bearer '' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = ''CRON_SECRET'' LIMIT 1),''x-cron-secret'',(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = ''CRON_SECRET'' LIMIT 1))','i');
 ELSIF j.command ~* 'headers\s*:?=\s*jsonb_build_object' AND j.command ~* 'body\s*:?=' THEN
  secured:=regexp_replace(j.command,'headers\s*:?=\s*.*?,\s*body\s*:?=','headers := jsonb_build_object(''Content-Type'',''application/json'',''Authorization'',''Bearer '' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = ''CRON_SECRET'' LIMIT 1),''x-cron-secret'',(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = ''CRON_SECRET'' LIMIT 1)), body :=','i');
 ELSE RAISE EXCEPTION 'Unexpected scheduler header format'; END IF;
 IF secured=j.command OR secured NOT LIKE '%x-cron-secret%' THEN RAISE EXCEPTION 'Scheduler credential substitution failed'; END IF;
 PERFORM cron.alter_job(j.jobid,command:=secured);
 IF before_schedule IS DISTINCT FROM (SELECT md5(string_agg(jsonb_build_object('id',jobid,'name',jobname,'schedule',schedule,'active',active)::text,'' ORDER BY jobid)) FROM cron.job) THEN RAISE EXCEPTION 'Scheduler timing or activation changed'; END IF;
END $migration$;