ALTER FUNCTION public.hs_admin_allowed() SECURITY INVOKER;
ALTER FUNCTION public.hs_admin(text,jsonb) RENAME TO hs_admin_internal;
REVOKE ALL ON FUNCTION public.hs_admin_internal(text,jsonb) FROM authenticated,anon,PUBLIC;
GRANT EXECUTE ON FUNCTION public.hs_admin_internal(text,jsonb) TO service_role;
CREATE OR REPLACE FUNCTION public.hs_admin(p_action text,p_payload jsonb,p_user_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
DECLARE result jsonb; claims text;
BEGIN
 IF auth.role()<>'service_role' OR p_user_id IS NULL THEN RAISE EXCEPTION 'HS_FORBIDDEN'; END IF;
 claims:=current_setting('request.jwt.claims',true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',p_user_id,'role','authenticated')::text,true);
 result:=public.hs_admin_internal(p_action,p_payload);
 PERFORM set_config('request.jwt.claims',COALESCE(claims,'{}'),true);
 RETURN result;
END;$fn$;
REVOKE ALL ON FUNCTION public.hs_admin(text,jsonb,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.hs_admin(text,jsonb,uuid) TO service_role;