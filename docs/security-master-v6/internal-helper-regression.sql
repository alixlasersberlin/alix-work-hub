-- Read-only privilege regression. Never invoke maintenance or provider operations.
DO $$ DECLARE f regprocedure; BEGIN
 FOREACH f IN ARRAY ARRAY[
  'public.alixdocs2_purge_deleted()'::regprocedure,
  'public.audit_retention_purge()'::regprocedure,
  'public.security_deactivate_stale_sessions()'::regprocedure,
  'public.expire_break_glass_sessions()'::regprocedure,
  'public.refresh_warranty_and_maintenance_status()'::regprocedure,
  'public.collect_sync_customer(text)'::regprocedure,
  'public.fc_refresh_order(uuid)'::regprocedure,
  'public.fc_upsert_case(text,text,text,uuid,uuid,uuid,text,text,numeric,text,boolean)'::regprocedure,
  'public.dl_upsert(text,text,uuid,text,text,timestamptz,text,text,text,jsonb)'::regprocedure,
  'public.sys_health_autofix()'::regprocedure,
  'public.sms_effective_config()'::regprocedure,
  'public.sms_reserve_send(uuid,text)'::regprocedure
 ] LOOP
  IF has_function_privilege('anon',f,'EXECUTE') OR has_function_privilege('authenticated',f,'EXECUTE')
     OR NOT has_function_privilege('service_role',f,'EXECUTE') THEN
   RAISE EXCEPTION 'Invalid privileges for %',f;
  END IF;
 END LOOP;
END $$;