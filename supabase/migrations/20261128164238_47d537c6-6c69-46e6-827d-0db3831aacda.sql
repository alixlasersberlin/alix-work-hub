CREATE OR REPLACE FUNCTION public.sms_effective_config() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v_sid text; v_from text; v_secret uuid; v_token text;
BEGIN
 IF coalesce(auth.role(),'') <> 'service_role' THEN RAISE EXCEPTION 'Server only' USING ERRCODE='42501'; END IF;
 SELECT account_sid,from_number,auth_token_secret_id INTO v_sid,v_from,v_secret FROM public.sms_settings WHERE id=true;
 IF v_secret IS NOT NULL THEN
  SELECT decrypted_secret INTO v_token FROM vault.decrypted_secrets WHERE id=v_secret;
  IF v_token IS NULL OR btrim(v_token)='' THEN RAISE EXCEPTION 'Configured SMS secret unavailable' USING ERRCODE='55000'; END IF;
 END IF;
 RETURN jsonb_build_object('account_sid',v_sid,'from_number',v_from,'auth_token',v_token);
END $$;
REVOKE ALL ON FUNCTION public.sms_effective_config() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sms_effective_config() TO service_role;
DO $$ BEGIN
 IF has_function_privilege('anon','public.sms_effective_config()','EXECUTE') OR has_function_privilege('authenticated','public.sms_effective_config()','EXECUTE') OR NOT has_function_privilege('service_role','public.sms_effective_config()','EXECUTE') THEN RAISE EXCEPTION 'SMS secret reader privileges invalid'; END IF;
END $$;
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN PERFORM public.sms_effective_config(); RAISE EXCEPTION 'SMS secret reachable by employee'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;