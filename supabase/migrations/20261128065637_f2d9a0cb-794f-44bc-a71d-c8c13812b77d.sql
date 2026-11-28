DO $migration$
DECLARE j record; secured text; before_schedule text; n integer:=0; definition text;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM vault.decrypted_secrets WHERE name='CRON_SECRET' AND decrypted_secret IS NOT NULL AND decrypted_secret<>'') THEN RAISE EXCEPTION 'Existing scheduler credential unavailable'; END IF;
 SELECT md5(string_agg(jsonb_build_object('id',jobid,'name',jobname,'schedule',schedule,'active',active)::text,'' ORDER BY jobid)) INTO before_schedule FROM cron.job;
 FOR j IN SELECT jobid,command FROM cron.job WHERE (jobid=30 AND command LIKE '%/functions/v1/maintenance-reminder-daily%') OR (jobid=35 AND command LIKE '%/functions/v1/offer-followup-engine%') OR (jobid=67 AND command LIKE '%/functions/v1/ac-alerts-check%') OR (jobid=70 AND command LIKE '%/functions/v1/ac-wfm-adherence-alerts%') OR (jobid=76 AND command LIKE '%/functions/v1/ac-playbook-run%') OR (jobid=77 AND command LIKE '%/functions/v1/ac-journey-run%') OR (jobid=122 AND command LIKE '%/functions/v1/delivery-approval-monthly-report%') LOOP
  IF j.command ~* 'headers\s*:?=\s*''[^'']*''::jsonb' THEN
   secured:=regexp_replace(j.command,'headers\s*:?=\s*''[^'']*''::jsonb','headers := jsonb_build_object(''Content-Type'',''application/json'',''Authorization'',''Bearer '' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = ''CRON_SECRET'' LIMIT 1),''x-cron-secret'',(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = ''CRON_SECRET'' LIMIT 1))','i');
  ELSE RAISE EXCEPTION 'Unexpected scheduler header format for %',j.jobid; END IF;
  IF secured=j.command OR secured NOT LIKE '%x-cron-secret%' THEN RAISE EXCEPTION 'Scheduler substitution failed'; END IF;
  PERFORM cron.alter_job(j.jobid,command:=secured); n:=n+1;
 END LOOP;
 IF n<>7 THEN RAISE EXCEPTION 'Expected exactly seven schedulers'; END IF;
 IF before_schedule IS DISTINCT FROM (SELECT md5(string_agg(jsonb_build_object('id',jobid,'name',jobname,'schedule',schedule,'active',active)::text,'' ORDER BY jobid)) FROM cron.job) THEN RAISE EXCEPTION 'Scheduler timing or activation changed'; END IF;
END $migration$;
DO $$ DECLARE claims text:=current_setting('request.jwt.claims',true); uid text:=current_setting('request.jwt.claim.sub',true); metrics jsonb; BEGIN
 PERFORM set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000000","role":"authenticated"}',true); PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000000',true);
 EXECUTE 'SET LOCAL ROLE authenticated';
 SELECT public.ac_dashboard_kpis(NULL::uuid) INTO metrics;
 IF (metrics->>'events')::integer<>0 OR (metrics->>'messages')::integer<>0 OR (metrics->>'contacts')::integer<>0 THEN RAISE EXCEPTION 'Unassigned dashboard leaks counts'; END IF;
 EXECUTE 'RESET ROLE'; PERFORM set_config('request.jwt.claims',coalesce(claims,''),true); PERFORM set_config('request.jwt.claim.sub',coalesce(uid,''),true);
END $$;