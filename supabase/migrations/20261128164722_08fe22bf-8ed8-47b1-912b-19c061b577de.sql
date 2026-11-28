CREATE OR REPLACE FUNCTION public.ac_wfm_auto_forecast(horizon_hours integer DEFAULT 24)
RETURNS TABLE(interval_start timestamptz,channel text,predicted_volume integer,required_agents integer)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.user_profiles p WHERE p.id=(SELECT auth.uid()) AND p.is_active IS TRUE AND p.account_status='active' AND p.invitation_status='accepted' AND p.password_reset_required IS FALSE)
  OR public.is_internal_staff() IS NOT TRUE
  OR NOT EXISTS(SELECT 1 FROM public.user_tenant_access uta JOIN public.tenants t ON t.id=uta.tenant_id WHERE uta.user_id=(SELECT auth.uid()) AND t.is_active IS TRUE)
 THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501'; END IF;
 IF horizon_hours IS NULL OR horizon_hours<1 OR horizon_hours>168 THEN RAISE EXCEPTION 'Forecast horizon must be between 1 and 168 hours' USING ERRCODE='22023'; END IF;
 RETURN QUERY WITH hist AS (
  SELECT extract(hour FROM c.created_at)::int AS h,extract(dow FROM c.created_at)::int AS dow,coalesce(c.channel_type::text,'other') AS ch,count(*)::numeric/4.0 AS avg_per_hour
  FROM public.ac_conversations c WHERE c.created_at>now()-interval '30 days'
   AND EXISTS(SELECT 1 FROM public.user_tenant_access uta JOIN public.tenants t ON t.id=uta.tenant_id WHERE uta.user_id=(SELECT auth.uid()) AND t.is_active IS TRUE AND t.id=c.tenant_id)
  GROUP BY h,dow,ch
 ),slots AS (SELECT generate_series(date_trunc('hour',now()),now()+make_interval(hours=>horizon_hours),interval '1 hour') AS ts),channels AS (SELECT DISTINCT hist.ch FROM hist)
 SELECT s.ts,c.ch,coalesce(ceil(h.avg_per_hour)::int,0),greatest(1,ceil(coalesce(h.avg_per_hour,0)*300.0/(3600.0*0.85))::int)
 FROM slots s CROSS JOIN channels c LEFT JOIN hist h ON h.h=extract(hour FROM s.ts)::int AND h.dow=extract(dow FROM s.ts)::int AND h.ch=c.ch ORDER BY s.ts,c.ch;
END $$;
REVOKE EXECUTE ON FUNCTION public.check_rate_limit(text,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(text,integer,integer) TO service_role;
DO $$ DECLARE u uuid; h text; result jsonb; n integer; BEGIN
 BEGIN
  u:=gen_random_uuid(); h:=md5(gen_random_uuid()::text)||md5(gen_random_uuid()::text);
  INSERT INTO public.api_rate_limits(bucket_key,request_at) SELECT 'sms:v1:user:'||u,clock_timestamp()-interval '10 seconds' FROM generate_series(1,19);
  result:=public.sms_reserve_send(u,h); IF result->>'allowed'<>'true' THEN RAISE EXCEPTION '20th employee SMS denied'; END IF;
  result:=public.sms_reserve_send(u,h); IF result->>'allowed'<>'false' OR result->>'scope'<>'user' THEN RAISE EXCEPTION '21st employee SMS allowed'; END IF;
  SELECT count(*) INTO n FROM public.api_rate_limits WHERE bucket_key='sms:v1:user:'||u; IF n<>20 THEN RAISE EXCEPTION 'Denied attempt consumed quota'; END IF;
  u:=gen_random_uuid(); h:=md5(gen_random_uuid()::text)||md5(gen_random_uuid()::text);
  INSERT INTO public.api_rate_limits(bucket_key,request_at) SELECT 'sms:v1:user:'||u,clock_timestamp()-interval '5 minutes' FROM generate_series(1,99);
  result:=public.sms_reserve_send(u,h); IF result->>'allowed'<>'true' THEN RAISE EXCEPTION '100th employee SMS denied'; END IF;
  result:=public.sms_reserve_send(u,h); IF result->>'allowed'<>'false' OR result->>'scope'<>'user' THEN RAISE EXCEPTION '101st employee SMS allowed'; END IF;
  h:=md5(gen_random_uuid()::text)||md5(gen_random_uuid()::text);
  INSERT INTO public.api_rate_limits(bucket_key,request_at) SELECT 'sms:v1:recipient:'||h,clock_timestamp()-interval '5 minutes' FROM generate_series(1,2);
  result:=public.sms_reserve_send(gen_random_uuid(),h); IF result->>'allowed'<>'true' THEN RAISE EXCEPTION '3rd recipient SMS denied'; END IF;
  result:=public.sms_reserve_send(gen_random_uuid(),h); IF result->>'allowed'<>'false' OR result->>'scope'<>'recipient' THEN RAISE EXCEPTION '4th recipient SMS allowed'; END IF;
  h:=md5(gen_random_uuid()::text)||md5(gen_random_uuid()::text);
  INSERT INTO public.api_rate_limits(bucket_key,request_at) SELECT 'sms:v1:recipient:'||h,clock_timestamp()-interval '2 hours' FROM generate_series(1,9);
  result:=public.sms_reserve_send(gen_random_uuid(),h); IF result->>'allowed'<>'true' THEN RAISE EXCEPTION '10th recipient SMS denied'; END IF;
  result:=public.sms_reserve_send(gen_random_uuid(),h); IF result->>'allowed'<>'false' OR result->>'scope'<>'recipient' THEN RAISE EXCEPTION '11th recipient SMS allowed'; END IF;
  IF NOT public.check_rate_limit('sms:v1:recipient:'||h,999999,1) THEN RAISE EXCEPTION 'Legacy limiter modified SMS namespace'; END IF;
  SELECT count(*) INTO n FROM public.api_rate_limits WHERE bucket_key='sms:v1:recipient:'||h; IF n<>10 THEN RAISE EXCEPTION 'Legacy limiter changed recipient quota'; END IF;
  RAISE EXCEPTION 'rollback synthetic quotas' USING ERRCODE='ZX001';
 EXCEPTION WHEN SQLSTATE 'ZX001' THEN NULL;
 END;
 IF has_function_privilege('authenticated','public.check_rate_limit(text,integer,integer)','EXECUTE') OR has_function_privilege('anon','public.check_rate_limit(text,integer,integer)','EXECUTE') THEN RAISE EXCEPTION 'Legacy limiter exposed'; END IF;
 IF (SELECT prosecdef FROM pg_proc WHERE oid='public.ac_wfm_auto_forecast(integer)'::regprocedure) THEN RAISE EXCEPTION 'Forecast bypasses RLS'; END IF;
END $$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000000"}',true);
DO $$ BEGIN
 BEGIN PERFORM public.ac_wfm_auto_forecast(24); RAISE EXCEPTION 'Inactive forecast allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.check_rate_limit('sms:v1:fake',100,1); RAISE EXCEPTION 'Employee limiter allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;