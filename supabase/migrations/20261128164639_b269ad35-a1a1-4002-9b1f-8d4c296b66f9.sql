REVOKE EXECUTE ON FUNCTION public.notify_super_admins(text,text,text,text,uuid,text),public.recompute_device_health(text),public.as_seed_default_checklists(uuid),public.dispatch_sync_appointment_to_calendar(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.notify_super_admins(text,text,text,text,uuid,text),public.recompute_device_health(text),public.as_seed_default_checklists(uuid),public.dispatch_sync_appointment_to_calendar(uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.dispatch_sync_all_appointments_to_calendar() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE r record; n integer:=0;
BEGIN
 IF public.can_plan_delivery() IS NOT TRUE THEN RAISE EXCEPTION 'Keine Planungsberechtigung' USING ERRCODE='42501'; END IF;
 FOR r IN SELECT a.id FROM public.delivery_appointments a WHERE a.planned_date IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.user_tenant_access uta JOIN public.tenants t ON t.id=uta.tenant_id WHERE uta.user_id=(SELECT auth.uid()) AND t.is_active IS TRUE AND t.id=a.tenant_id)
 LOOP
  IF public.dispatch_sync_appointment_to_calendar(r.id) IS NOT NULL THEN n:=n+1; END IF;
 END LOOP;
 RETURN n;
END $$;
DO $$ DECLARE f regprocedure; definition text; old_guard text := 'IF NOT EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id = uid AND p.is_active) THEN'; new_guard text := 'IF NOT EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id = uid AND p.is_active IS TRUE AND p.account_status = ''active'' AND p.invitation_status = ''accepted'' AND p.password_reset_required IS FALSE) THEN'; BEGIN
 FOREACH f IN ARRAY ARRAY['public.mobile_magic_search(text)'::regprocedure,'public.get_mobile_command_center()'::regprocedure] LOOP
  definition:=pg_get_functiondef(f);
  IF position(old_guard IN definition)=0 OR position('SECURITY DEFINER' IN definition)=0 THEN RAISE EXCEPTION 'Unexpected mobile function definition: %',f; END IF;
  definition:=replace(replace(definition,old_guard,new_guard),'SECURITY DEFINER','SECURITY INVOKER');
  EXECUTE definition;
 END LOOP;
END $$;
DO $$ DECLARE f regprocedure; BEGIN
 FOREACH f IN ARRAY ARRAY['public.notify_super_admins(text,text,text,text,uuid,text)'::regprocedure,'public.recompute_device_health(text)'::regprocedure,'public.as_seed_default_checklists(uuid)'::regprocedure,'public.dispatch_sync_appointment_to_calendar(uuid)'::regprocedure] LOOP
  IF has_function_privilege('anon',f,'EXECUTE') OR has_function_privilege('authenticated',f,'EXECUTE') OR NOT has_function_privilege('service_role',f,'EXECUTE') THEN RAISE EXCEPTION 'Internal helper still exposed: %',f; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM pg_proc WHERE oid IN ('public.mobile_magic_search(text)'::regprocedure,'public.get_mobile_command_center()'::regprocedure) AND prosecdef) THEN RAISE EXCEPTION 'Mobile reader still bypasses RLS'; END IF;
END $$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000000"}',true);
DO $$ BEGIN
 BEGIN PERFORM public.dispatch_sync_all_appointments_to_calendar(); RAISE EXCEPTION 'Unassigned planner accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.mobile_magic_search('zz'); RAISE EXCEPTION 'Inactive search accepted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT IN ('inactive user','not authenticated') THEN RAISE; END IF; END;
 BEGIN PERFORM public.get_mobile_command_center(); RAISE EXCEPTION 'Inactive command center accepted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT IN ('inactive user','not authenticated') THEN RAISE; END IF; END;
END $$;
RESET ROLE;