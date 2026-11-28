DO $$
DECLARE
  j record;
  v_new text;
  v_hdr constant text := $h$headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET' LIMIT 1),'x-cron-secret',(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET' LIMIT 1))$h$;
BEGIN
  FOR j IN SELECT jobid, command FROM cron.job WHERE jobid IN (26,45,47,54,55,59,60,73,110,123,124,125,131) LOOP
    v_new := regexp_replace(j.command, $re$headers\s*:=\s*'\{[^']*\}'(::jsonb)?$re$, v_hdr, 'i');
    IF v_new = j.command OR v_new NOT LIKE '%CRON_SECRET%' THEN
      RAISE EXCEPTION 'cron job % header not rewritten', j.jobid;
    END IF;
    PERFORM cron.alter_job(job_id := j.jobid, command := v_new);
  END LOOP;
END $$;