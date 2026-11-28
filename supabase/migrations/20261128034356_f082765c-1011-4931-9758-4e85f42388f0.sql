DO $check$
DECLARE credential text;
BEGIN
  IF EXISTS (SELECT 1 FROM public.survey_automation_rules WHERE id = '00000000-0000-0000-0000-000000000000'::uuid) THEN
    RAISE EXCEPTION 'Read-only test identity unexpectedly exists';
  END IF;
  SELECT decrypted_secret INTO credential FROM vault.decrypted_secrets WHERE name='CRON_SECRET' LIMIT 1;
  IF credential IS NULL OR length(credential)=0 THEN RAISE EXCEPTION 'Existing scheduler credential unavailable'; END IF;
  PERFORM net.http_post(
    url := 'https://xmrmkgfgpoundfwhnxfs.supabase.co/functions/v1/survey-automation',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || credential,'x-cron-secret',credential),
    body := '{"rule_id":"00000000-0000-0000-0000-000000000000","dry_run":true}'::jsonb
  );
END
$check$;