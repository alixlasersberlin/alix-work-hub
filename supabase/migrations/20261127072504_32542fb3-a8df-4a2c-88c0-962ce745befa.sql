-- lovable-cron-fallback-reviewed: Queue wakes on enqueue; short delays use event-driven timers; minute fallback is armed only while pending future retries exist and unscheduled after drain; all acceptance gates currently false.
CREATE FUNCTION public.ph2_arm_retries() RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE active boolean; pending boolean; jid bigint;
BEGIN
 PERFORM pg_advisory_xact_lock(272004,1);
 SELECT value @> '{"enabled":true,"backup_verified":true,"restore_verified":true,"communication_verified":true}'::jsonb AND length(coalesce(value->>'approved_by',''))>0 INTO active FROM public.ph_settings WHERE key='ph2_activation';
 SELECT EXISTS(SELECT 1 FROM public.ph_sync_log WHERE operation='ph2_signal' AND direction='outbound' AND status IN ('queued','sending','retry','awaiting_receipt')) INTO pending;
 SELECT jobid INTO jid FROM cron.job WHERE jobname='ph2-queue-recovery' LIMIT 1;
 IF NOT coalesce(active,false) OR NOT pending THEN
  IF jid IS NOT NULL THEN PERFORM cron.unschedule(jid); END IF;
  RETURN false;
 END IF;
 IF jid IS NULL THEN
  PERFORM cron.schedule('ph2-queue-recovery','* * * * *',$job$ SELECT net.http_post(url:='https://xmrmkgfgpoundfwhnxfs.supabase.co/functions/v1/ph-signal-dispatch',headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='CRON_SECRET' LIMIT 1)),body:='{"limit":10}'::jsonb); $job$);
 END IF;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.ph2_arm_retries() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ph2_arm_retries() TO service_role;
CREATE FUNCTION public.ph2_retry_arm_trigger() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.operation='ph2_signal' THEN PERFORM public.ph2_arm_retries(); END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.ph2_retry_arm_trigger() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER ph2_arm_pending AFTER INSERT OR UPDATE OF status ON public.ph_sync_log FOR EACH ROW EXECUTE FUNCTION public.ph2_retry_arm_trigger();
