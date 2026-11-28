-- Run against the connected database; synthetic reservations always roll back. No SMS is sent.
BEGIN;
DO $$
DECLARE u uuid; h text; r jsonb; n int;
BEGIN
 IF has_function_privilege('anon','public.sms_reserve_send(uuid,text)','EXECUTE') OR has_function_privilege('authenticated','public.sms_reserve_send(uuid,text)','EXECUTE') THEN RAISE EXCEPTION 'Limiter exposed to client'; END IF;
 IF NOT has_function_privilege('service_role','public.sms_reserve_send(uuid,text)','EXECUTE') THEN RAISE EXCEPTION 'Service cannot reserve'; END IF;

 -- Authenticated legacy limiter must not delete or add dedicated SMS reservations.
 u := gen_random_uuid();
 INSERT INTO public.api_rate_limits(bucket_key,request_at) VALUES ('sms:v1:user:'||u,clock_timestamp()-interval '2 hours');
 IF NOT public.check_rate_limit('sms:v1:user:'||u,100,60) THEN RAISE EXCEPTION 'Legacy limiter accepted SMS namespace'; END IF;
 SELECT count(*) INTO n FROM public.api_rate_limits WHERE bucket_key='sms:v1:user:'||u;
 IF n<>1 THEN RAISE EXCEPTION 'Legacy limiter changed SMS quota'; END IF;

 -- Rule: employee 20/minute, twenty-first denied; failed reservation inserts nothing.
 u := gen_random_uuid(); h := repeat('a',64);
 INSERT INTO public.api_rate_limits(bucket_key,request_at) SELECT 'sms:v1:user:'||u,clock_timestamp()-interval '10 seconds' FROM generate_series(1,19);
 r := public.sms_reserve_send(u,h); IF r->>'allowed' <> 'true' THEN RAISE EXCEPTION '20th SMS denied'; END IF;
 r := public.sms_reserve_send(u,h); IF r->>'allowed' <> 'false' OR r->>'scope'<>'user' OR (r->>'retry_after_seconds')::int NOT BETWEEN 1 AND 60 THEN RAISE EXCEPTION '21st SMS not blocked'; END IF;
 SELECT count(*) INTO n FROM public.api_rate_limits WHERE bucket_key='sms:v1:user:'||u;
 IF n<>20 THEN RAISE EXCEPTION 'Denied reservation consumed quota'; END IF;

 -- Rule: employee 100/hour, 101st denied independent of minute window.
 u := gen_random_uuid(); h := repeat('b',64);
 INSERT INTO public.api_rate_limits(bucket_key,request_at) SELECT 'sms:v1:user:'||u,clock_timestamp()-interval '5 minutes' FROM generate_series(1,99);
 r := public.sms_reserve_send(u,h); IF r->>'allowed'<>'true' THEN RAISE EXCEPTION '100th SMS denied'; END IF;
 r := public.sms_reserve_send(u,h); IF r->>'allowed'<>'false' OR r->>'scope'<>'user' THEN RAISE EXCEPTION '101st SMS not blocked'; END IF;

 -- Rule: same recipient 3/hour across distinct employees and endpoints.
 h := repeat('c',64);
 INSERT INTO public.api_rate_limits(bucket_key,request_at) SELECT 'sms:v1:recipient:'||h,clock_timestamp()-interval '5 minutes' FROM generate_series(1,2);
 r := public.sms_reserve_send(gen_random_uuid(),h); IF r->>'allowed'<>'true' THEN RAISE EXCEPTION '3rd recipient SMS denied'; END IF;
 r := public.sms_reserve_send(gen_random_uuid(),h); IF r->>'allowed'<>'false' OR r->>'scope'<>'recipient' THEN RAISE EXCEPTION '4th recipient SMS not blocked'; END IF;

 -- Rule: same recipient 10/24h independent of hourly window.
 h := repeat('d',64);
 INSERT INTO public.api_rate_limits(bucket_key,request_at) SELECT 'sms:v1:recipient:'||h,clock_timestamp()-interval '2 hours' FROM generate_series(1,9);
 r := public.sms_reserve_send(gen_random_uuid(),h); IF r->>'allowed'<>'true' THEN RAISE EXCEPTION '10th recipient SMS denied'; END IF;
 r := public.sms_reserve_send(gen_random_uuid(),h); IF r->>'allowed'<>'false' OR r->>'scope'<>'recipient' THEN RAISE EXCEPTION '11th recipient SMS not blocked'; END IF;
END $$;
ROLLBACK;