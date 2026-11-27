CREATE OR REPLACE FUNCTION ph_signal_private.ph2_retry(_event_id uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE q public.ph_sync_log;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.user_profiles p JOIN public.user_roles ur ON ur.user_id=p.id JOIN public.roles r ON r.id=ur.role_id WHERE p.id=auth.uid() AND p.account_status='active' AND p.invitation_status='accepted' AND p.password_reset_required=false AND r.name='Super Admin') THEN RAISE EXCEPTION 'Nur aktive Super Admins'; END IF;
 SELECT * INTO q FROM public.ph_sync_log WHERE id=_event_id AND operation='ph2_signal' FOR UPDATE;
 IF NOT FOUND OR q.status<>'failed' THEN RETURN false; END IF;
 IF EXISTS(SELECT 1 FROM public.ph_sync_log n WHERE n.operation='ph2_signal' AND n.product_id=q.product_id AND n.channel_code=q.channel_code AND (n.payload->'signal'->>'version')>(q.payload->'signal'->>'version')) THEN RAISE EXCEPTION 'Veraltetes Ereignis'; END IF;
 UPDATE public.ph_sync_log SET status=CASE WHEN direction='shadow' THEN 'queued_shadow' ELSE 'queued' END,
  payload=(payload-'lease_token'-'lease_until')||jsonb_build_object('attempts',0,'next_attempt_at',now(),'manual_retry_by',auth.uid(),'previous_error',payload->>'last_error') WHERE id=q.id;
 RETURN true;
END $$;
DO $test$
DECLARE uid uuid; got boolean;
BEGIN
 SELECT p.id INTO uid FROM public.user_profiles p JOIN public.user_roles ur ON ur.user_id=p.id JOIN public.roles r ON r.id=ur.role_id WHERE p.account_status='active' AND r.name='Admin' AND NOT EXISTS(SELECT 1 FROM public.user_roles x JOIN public.roles xr ON xr.id=x.role_id WHERE x.user_id=p.id AND xr.name='Super Admin') LIMIT 1;
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',coalesce(uid,gen_random_uuid()),'role','authenticated')::text,true);
 BEGIN
  PERFORM public.ph2_retry(gen_random_uuid());
  RAISE EXCEPTION 'PH2_PERMISSION_TEST_FAILED';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM<>'Nur aktive Super Admins' THEN RAISE; END IF;
 END;
 PERFORM set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000099"}',true);
 BEGIN
  PERFORM public.ph2_retry(gen_random_uuid());
  RAISE EXCEPTION 'PH2_PERMISSION_TEST_FAILED';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM<>'Nur aktive Super Admins' THEN RAISE; END IF;
 END;
 PERFORM set_config('request.jwt.claims','{}',true);
END $test$;