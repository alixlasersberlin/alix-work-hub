CREATE OR REPLACE FUNCTION public.has_role(check_role text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT EXISTS (SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id=ur.role_id JOIN public.user_profiles p ON p.id=ur.user_id WHERE ur.user_id=(SELECT auth.uid()) AND r.name=check_role AND p.is_active IS TRUE AND p.account_status='active' AND p.invitation_status='accepted' AND p.password_reset_required IS FALSE);
$$;
CREATE OR REPLACE FUNCTION public.user_tenant_codes() RETURNS text[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT COALESCE(array_agg(DISTINCT t.code),ARRAY[]::text[]) FROM public.user_tenant_access a JOIN public.tenants t ON t.id=a.tenant_id JOIN public.user_profiles p ON p.id=a.user_id WHERE a.user_id=(SELECT auth.uid()) AND t.is_active IS TRUE AND p.is_active IS TRUE AND p.account_status='active' AND p.invitation_status='accepted' AND p.password_reset_required IS FALSE;
$$;
CREATE OR REPLACE FUNCTION public.user_has_tenant(_tenant_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT EXISTS (SELECT 1 FROM public.user_tenant_access a JOIN public.tenants t ON t.id=a.tenant_id JOIN public.user_profiles p ON p.id=a.user_id WHERE a.user_id=(SELECT auth.uid()) AND a.tenant_id=_tenant_id AND t.is_active IS TRUE AND p.is_active IS TRUE AND p.account_status='active' AND p.invitation_status='accepted' AND p.password_reset_required IS FALSE);
$$;
CREATE OR REPLACE FUNCTION public.tenant_scope_restricted() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 WITH u AS (SELECT public.user_tenant_codes() AS c) SELECT cardinality(u.c)=0 OR NOT (ARRAY(SELECT DISTINCT t.code FROM public.tenants t WHERE t.is_active IS TRUE AND t.code IS NOT NULL) <@ u.c) FROM u;
$$;
CREATE OR REPLACE FUNCTION public.tenant_scope_ok(_source text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT (NOT public.tenant_scope_restricted()) OR EXISTS (SELECT 1 FROM public.tenants t WHERE t.is_active IS TRUE AND t.zoho_source_system=_source AND t.code=ANY(public.user_tenant_codes()));
$$;
CREATE OR REPLACE FUNCTION public.tenant_scope_id_ok(_tenant_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT (NOT public.tenant_scope_restricted()) OR public.user_has_tenant(_tenant_id);
$$;
CREATE OR REPLACE FUNCTION public.tenant_scope_ok_id(_tenant_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT public.tenant_scope_id_ok(_tenant_id);
$$;
-- Preserve existing execute grants: anonymous policy dependencies were not removed.
-- Every decision below runs with a concrete auth.uid; no business data writes.
DO $$ DECLARE u record; role_name text; expected boolean; original_claims text:=current_setting('request.jwt.claims',true); BEGIN
 FOR u IN SELECT p.id,p.is_active,p.account_status,p.invitation_status,p.password_reset_required FROM public.user_profiles p LOOP
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',u.id,'role','authenticated')::text,true);
  PERFORM set_config('request.jwt.claim.sub',u.id::text,true);
  FOR role_name IN SELECT name FROM public.roles LOOP
   SELECT EXISTS(SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id=ur.role_id WHERE ur.user_id=u.id AND r.name=role_name) AND u.is_active IS TRUE AND u.account_status='active' AND u.invitation_status='accepted' AND u.password_reset_required IS FALSE INTO expected;
   IF public.has_role(role_name) IS DISTINCT FROM expected THEN RAISE EXCEPTION 'Exact role regression failed'; END IF;
  END LOOP;
  IF public.user_has_tenant('00000000-0000-0000-0000-000000000000'::uuid) THEN RAISE EXCEPTION 'Foreign tenant access regression'; END IF;
 END LOOP;
 PERFORM set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000000","role":"authenticated"}',true);
 PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000000',true);
 IF public.has_role('Super Admin') OR public.has_role('Admin') OR NOT public.tenant_scope_restricted() OR public.tenant_scope_ok('zoho_eu_1') OR public.tenant_scope_id_ok(NULL) OR cardinality(public.user_tenant_codes())<>0 THEN RAISE EXCEPTION 'Unassigned identity must fail closed'; END IF;
 PERFORM set_config('request.jwt.claims',COALESCE(original_claims,''),true);
 PERFORM set_config('request.jwt.claim.sub','',true);
END $$;