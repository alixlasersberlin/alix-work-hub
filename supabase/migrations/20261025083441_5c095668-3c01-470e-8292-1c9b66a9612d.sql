DO $migration$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('public.hs_api(text,text,jsonb,text)'::regprocedure) INTO definition;
 definition:=replace(definition,'IF p_action=''find_customer'' THEN','IF p_action=''find_customer'' THEN
     key:=p_payload->>''external_customer_id'';
     IF key IS NULL OR length(key)>128 OR key!~''^[A-Za-z0-9_.-]+$'' THEN RAISE EXCEPTION ''HS_INVALID_INPUT''; END IF;');
 definition:=replace(definition,'event=''customer'' AND payload->>''email''=email','event=''customer'' AND external_id=key AND payload->>''email''=email');
 definition:=replace(definition,'AND lower(customers.email)=email','AND raw_data->>''shop_customer_id''=key AND lower(customers.email)=email');
 definition:=replace(definition,'''shop_payment_report'',p_payload->''payment_report''','''shop_payment_report'',CASE WHEN p_payload->''payment_report'' IS NULL THEN NULL ELSE (p_payload->''payment_report'')||jsonb_build_object(''verification_status'',''unverified'',''authoritative'',false) END');
 EXECUTE definition;
 SELECT pg_get_functiondef('public.hs_admin_internal(text,jsonb)'::regprocedure) INTO definition;
 definition:=replace(definition,'p.tax_rate IS NOT NULL AND','p.tax_rate>=0 AND p.tax_rate<=100 AND (p.valid_from IS NULL OR p.valid_from<=current_date) AND (p.valid_until IS NULL OR p.valid_until>=current_date) AND');
 EXECUTE definition;
END;$migration$;
CREATE OR REPLACE FUNCTION public.hs_admin_rate_limit(p_user_id uuid,p_action text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
DECLARE k text; n integer; lim integer;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' OR p_user_id IS NULL THEN RAISE EXCEPTION 'HS_FORBIDDEN'; END IF;
 k:='hs:admin:'||p_user_id::text||':'||CASE WHEN p_action='self_test' THEN 'test' ELSE 'actions' END;
 lim:=CASE WHEN p_action='self_test' THEN 2 ELSE 60 END;
 PERFORM pg_advisory_xact_lock(hashtextextended(k,0));
 SELECT count(*) INTO n FROM public.api_rate_limits WHERE bucket_key=k AND request_at>clock_timestamp()-interval '1 minute';
 IF n>=lim THEN RETURN false; END IF;
 INSERT INTO public.api_rate_limits(bucket_key,request_at) VALUES(k,clock_timestamp());
 DELETE FROM public.api_rate_limits WHERE bucket_key=k AND request_at<clock_timestamp()-interval '10 minutes';
 RETURN true;
END;$fn$;
REVOKE ALL ON FUNCTION public.hs_admin_rate_limit(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.hs_admin_rate_limit(uuid,text) TO service_role;
REVOKE ALL ON FUNCTION public.hs_api(text,text,jsonb,text),public.hs_admin_internal(text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.hs_api(text,text,jsonb,text),public.hs_admin_internal(text,jsonb) TO service_role;