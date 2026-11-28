CREATE OR REPLACE FUNCTION public.sms_reserve_send(p_user_id uuid, p_recipient_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
 v_keys text[]; v_limits int[] := ARRAY[20,100,3,10]; v_windows int[] := ARRAY[60,3600,3600,86400];
 v_now timestamptz; v_count bigint; v_oldest timestamptz; v_retry int := 0; v_scope text; i int;
BEGIN
 IF p_user_id IS NULL OR p_recipient_hash IS NULL OR p_recipient_hash !~ '^[a-f0-9]{64}$' THEN
  RAISE EXCEPTION 'Invalid SMS limiter identity' USING ERRCODE = '22023';
 END IF;
 v_keys := ARRAY['sms:v1:user:' || p_user_id::text,'sms:v1:user:' || p_user_id::text,'sms:v1:recipient:' || p_recipient_hash,'sms:v1:recipient:' || p_recipient_hash];
 PERFORM pg_advisory_xact_lock(hashtextextended(v_keys[1],0));
 PERFORM pg_advisory_xact_lock(hashtextextended(v_keys[3],0));
 v_now := clock_timestamp();
 FOR i IN 1..4 LOOP
  SELECT count(*), min(request_at) INTO v_count,v_oldest FROM public.api_rate_limits
   WHERE bucket_key=v_keys[i] AND request_at > v_now - make_interval(secs => v_windows[i]);
  IF v_count >= v_limits[i] THEN
   IF greatest(1,ceil(extract(epoch FROM (v_oldest + make_interval(secs => v_windows[i]) - v_now)))::int) > v_retry THEN
    v_retry := greatest(1,ceil(extract(epoch FROM (v_oldest + make_interval(secs => v_windows[i]) - v_now)))::int);
    v_scope := CASE WHEN i <= 2 THEN 'user' ELSE 'recipient' END;
   END IF;
  END IF;
 END LOOP;
 IF v_retry > 0 THEN RETURN jsonb_build_object('allowed',false,'retry_after_seconds',v_retry,'scope',v_scope); END IF;
 INSERT INTO public.api_rate_limits(bucket_key,request_at) VALUES (v_keys[1],v_now),(v_keys[3],v_now);
 RETURN jsonb_build_object('allowed',true);
END; $$;
REVOKE ALL ON FUNCTION public.sms_reserve_send(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sms_reserve_send(uuid,text) TO service_role;
COMMENT ON FUNCTION public.sms_reserve_send(uuid,text) IS 'Service-only shared SMS attempt reservation. Call after caller/tenant/recipient checks. Failed and uncertain provider attempts consume quota; never auto-retry. No recipient plaintext stored.';