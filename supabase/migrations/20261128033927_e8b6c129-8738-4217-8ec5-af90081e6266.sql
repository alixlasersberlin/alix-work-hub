DO $migration$
DECLARE j record; secured text; n integer := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET' AND length(decrypted_secret) > 0) THEN
    RAISE EXCEPTION 'Existing scheduler credential unavailable';
  END IF;
  FOR j IN SELECT jobid, command FROM cron.job WHERE command ~ '/functions/v1/(rz-reminder-build|scheduled-customer-sync|scheduled-order-sync|portal-contract-reminders|survey-auto-reminders|survey-automation|system-health-scan)([^a-zA-Z0-9_-]|$)'
  LOOP
    IF j.command ~* 'headers\s*:?=\s*''[^'']*''::jsonb' THEN
      secured := regexp_replace(j.command, 'headers\s*:?=\s*''[^'']*''::jsonb', 'headers := jsonb_build_object(''Content-Type'', ''application/json'', ''Authorization'', ''Bearer '' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = ''CRON_SECRET'' LIMIT 1), ''x-cron-secret'', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = ''CRON_SECRET'' LIMIT 1))', 'i');
      PERFORM cron.alter_job(j.jobid, command := secured);
      n := n + 1;
    ELSIF j.command NOT LIKE '%vault.decrypted_secrets%' THEN
      RAISE EXCEPTION 'Unsupported scheduler header structure for job %', j.jobid;
    END IF;
  END LOOP;
  RAISE NOTICE 'Secured % existing scheduler commands; timing and activation unchanged', n;
END
$migration$;