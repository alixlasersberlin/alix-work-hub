CREATE OR REPLACE FUNCTION public.is_internal_staff() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT public.is_internal_user()
  AND NOT EXISTS(SELECT 1 FROM public.customer_portal_users WHERE user_id=(SELECT auth.uid()))
  AND NOT public.has_role('Lieferant') AND NOT public.has_role('Lieferant Jerry')
  AND NOT(public.has_role('Angebotsersteller') AND NOT EXISTS(SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id=ur.role_id WHERE ur.user_id=(SELECT auth.uid()) AND r.name<>'Angebotsersteller'));
$$;
CREATE OR REPLACE FUNCTION public.is_internal_or_supplier() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT public.is_internal_user() AND NOT EXISTS(SELECT 1 FROM public.customer_portal_users WHERE user_id=(SELECT auth.uid()));
$$;
CREATE OR REPLACE FUNCTION public.esc_is_staff() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$ SELECT public.is_internal_user(); $$;
CREATE OR REPLACE FUNCTION public.is_mobile_supervisor() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT public.is_internal_user() AND (public.has_role('Super Admin') OR public.has_role('Admin') OR public.has_role('Teamleiter') OR public.has_role('Supervisor'));
$$;
DO $$ DECLARE saved text:=current_setting('request.jwt.claims',true); u uuid; BEGIN
 PERFORM set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000000"}',true);
 IF public.is_internal_staff() OR public.is_internal_or_supplier() OR public.esc_is_staff() OR public.is_mobile_supervisor() THEN RAISE EXCEPTION 'Unassigned nonexistent account treated as staff'; END IF;
 PERFORM set_config('request.jwt.claims','{"role":"anon"}',true);
 IF public.is_internal_staff() OR public.is_internal_or_supplier() OR public.esc_is_staff() OR public.is_mobile_supervisor() THEN RAISE EXCEPTION 'Anonymous staff bypass'; END IF;
 SELECT p.id INTO u FROM public.user_profiles p WHERE p.is_active IS TRUE AND p.account_status='active' AND p.invitation_status='accepted' AND p.password_reset_required IS FALSE
  AND EXISTS(SELECT 1 FROM public.user_tenant_access a JOIN public.tenants t ON t.id=a.tenant_id WHERE a.user_id=p.id AND t.is_active IS TRUE)
  AND EXISTS(SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id=ur.role_id WHERE ur.user_id=p.id AND r.name='Super Admin')
  AND NOT EXISTS(SELECT 1 FROM public.customer_portal_users cp WHERE cp.user_id=p.id)
  AND NOT EXISTS(SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id=ur.role_id WHERE ur.user_id=p.id AND r.name IN ('Lieferant','Lieferant Jerry')) LIMIT 1;
 IF u IS NULL THEN RAISE EXCEPTION 'No existing active supervisor for read-only compatibility check'; END IF;
 PERFORM set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',u)::text,true);
 IF NOT public.is_internal_staff() OR NOT public.is_internal_or_supplier() OR NOT public.esc_is_staff() OR NOT public.is_mobile_supervisor() THEN RAISE EXCEPTION 'Existing active supervisor lost staff access'; END IF;
 PERFORM set_config('request.jwt.claims',coalesce(saved,''),true);
END $$;