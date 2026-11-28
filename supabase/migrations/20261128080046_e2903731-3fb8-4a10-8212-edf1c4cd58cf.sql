DO $migration$
DECLARE j record; secured text; before_schedule text; n integer := 0;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM vault.decrypted_secrets WHERE name='CRON_SECRET' AND decrypted_secret IS NOT NULL AND decrypted_secret<>'') THEN RAISE EXCEPTION 'Existing scheduler credential unavailable'; END IF;
 SELECT md5(string_agg(jsonb_build_object('id',jobid,'name',jobname,'schedule',schedule,'active',active)::text,'' ORDER BY jobid)) INTO before_schedule FROM cron.job;
 FOR j IN SELECT jobid, command FROM cron.job WHERE (jobid=41 AND command LIKE '%/functions/v1/ticket-customer-reminder%') OR (jobid=57 AND command LIKE '%/functions/v1/orders-inbox-process%') OR (jobid=61 AND command LIKE '%/functions/v1/alixdocs-expiry-scan%') OR (jobid=104 AND command LIKE '%/functions/v1/license-royalty-run%') OR (jobid=113 AND command LIKE '%/functions/v1/collect-morning-report%') OR (jobid=134 AND command LIKE '%/functions/v1/escalation-engine%') OR (jobid=32 AND command LIKE '%/functions/v1/finance-reminder-engine%') OR (jobid=132 AND command LIKE '%/functions/v1/delivery-escalation-engine%') LOOP
  IF j.command ~* 'headers\s*:?=\s*''[^'']*''::jsonb' THEN
   secured:=regexp_replace(j.command,'headers\s*:?=\s*''[^'']*''::jsonb','headers := jsonb_build_object(''Content-Type'',''application/json'',''Authorization'',''Bearer '' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = ''CRON_SECRET'' LIMIT 1),''x-cron-secret'',(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = ''CRON_SECRET'' LIMIT 1))','i');
  ELSIF j.command ~* 'headers\s*:?=\s*jsonb_build_object' AND j.command ~* 'body\s*:?=' THEN
   secured:=regexp_replace(j.command,'headers\s*:?=\s*.*?,\s*body\s*:?=','headers := jsonb_build_object(''Content-Type'',''application/json'',''Authorization'',''Bearer '' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = ''CRON_SECRET'' LIMIT 1),''x-cron-secret'',(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = ''CRON_SECRET'' LIMIT 1)), body :=','i');
  ELSE RAISE EXCEPTION 'Unexpected scheduler header format for %',j.jobid; END IF;
  IF secured=j.command OR secured NOT LIKE '%x-cron-secret%' THEN RAISE EXCEPTION 'Scheduler credential substitution failed'; END IF;
  PERFORM cron.alter_job(j.jobid,command:=secured); n:=n+1;
 END LOOP;
 IF n<>8 THEN RAISE EXCEPTION 'Expected exactly eight existing schedulers'; END IF;
 IF before_schedule IS DISTINCT FROM (SELECT md5(string_agg(jsonb_build_object('id',jobid,'name',jobname,'schedule',schedule,'active',active)::text,'' ORDER BY jobid)) FROM cron.job) THEN RAISE EXCEPTION 'Scheduler timing or activation changed'; END IF;
END $migration$;