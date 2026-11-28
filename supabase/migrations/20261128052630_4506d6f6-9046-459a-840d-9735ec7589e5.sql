DO $migration$
DECLARE j record; secured text; n integer:=0; before_schedule text;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM vault.decrypted_secrets WHERE name='CRON_SECRET' AND decrypted_secret IS NOT NULL AND decrypted_secret<>'') THEN RAISE EXCEPTION 'Existing scheduler credential unavailable'; END IF;
 SELECT md5(string_agg(jsonb_build_object('id',jobid,'name',jobname,'schedule',schedule,'active',active)::text,'' ORDER BY jobid)) INTO before_schedule FROM cron.job;
 FOR j IN SELECT jobid,command FROM cron.job WHERE command ~ '/functions/v1/(finance-automations-engine|bank-auto-reconcile|bank-api-fetch|cmr-bank-automatch|cmr-recurring-run|cmr-collective-run|bank-return-dunning-escalate)([^a-zA-Z0-9_-]|$)' LOOP
  IF j.command ~* 'headers\s*:?=\s*''[^'']*''::jsonb' THEN
   secured:=regexp_replace(j.command,'headers\s*:?=\s*''[^'']*''::jsonb','headers := jsonb_build_object(''Content-Type'',''application/json'',''Authorization'',''Bearer '' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = ''CRON_SECRET'' LIMIT 1),''x-cron-secret'',(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = ''CRON_SECRET'' LIMIT 1))','i');
   PERFORM cron.alter_job(j.jobid,command:=secured);
  ELSIF j.command NOT LIKE '%vault.decrypted_secrets%' THEN RAISE EXCEPTION 'Unsupported scheduler header structure'; END IF;
  n:=n+1;
 END LOOP;
 IF n<>7 THEN RAISE EXCEPTION 'Expected exactly seven existing financial scheduler callers'; END IF;
 IF before_schedule IS DISTINCT FROM (SELECT md5(string_agg(jsonb_build_object('id',jobid,'name',jobname,'schedule',schedule,'active',active)::text,'' ORDER BY jobid)) FROM cron.job) THEN RAISE EXCEPTION 'Scheduler timing or activation changed'; END IF;
END $migration$;