CREATE OR REPLACE FUNCTION public.expire_temporary_role_grants() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v_count integer;
BEGIN
 IF NOT ((auth.uid() IS NULL AND coalesce(auth.role(),'') NOT IN ('anon','authenticated') AND session_user IN ('postgres','supabase_admin')) OR coalesce(auth.role(),'')='service_role' OR (public.has_role('Super Admin') AND cardinality(public.user_tenant_codes())>0)) THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501'; END IF;
 WITH updated AS (UPDATE public.role_temporary_grants SET status='expired',auto_revoked_at=now() WHERE status='active' AND valid_until<=now() RETURNING id) SELECT count(*) INTO v_count FROM updated;
 RETURN v_count;
END $$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000000"}',true);
DO $$ BEGIN
 BEGIN PERFORM public.expire_temporary_role_grants(); RAISE EXCEPTION 'Missing-role claim bypass'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;