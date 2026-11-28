REVOKE EXECUTE ON FUNCTION public.alixdocs2_purge_deleted(),public.audit_retention_purge(),public.security_deactivate_stale_sessions(),public.expire_break_glass_sessions(),public.refresh_warranty_and_maintenance_status(),public.collect_sync_customer(text),public.fc_refresh_order(uuid),public.fc_upsert_case(text,text,text,uuid,uuid,uuid,text,text,numeric,text,boolean),public.dl_upsert(text,text,uuid,text,text,timestamptz,text,text,text,jsonb),public.sys_health_autofix() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.alixdocs2_purge_deleted(),public.audit_retention_purge(),public.security_deactivate_stale_sessions(),public.expire_break_glass_sessions(),public.refresh_warranty_and_maintenance_status(),public.collect_sync_customer(text),public.fc_refresh_order(uuid),public.fc_upsert_case(text,text,text,uuid,uuid,uuid,text,text,numeric,text,boolean),public.dl_upsert(text,text,uuid,text,text,timestamptz,text,text,text,jsonb),public.sys_health_autofix() TO service_role;
DO $$ DECLARE f regprocedure; BEGIN
 FOREACH f IN ARRAY ARRAY['public.alixdocs2_purge_deleted()'::regprocedure,'public.audit_retention_purge()'::regprocedure,'public.security_deactivate_stale_sessions()'::regprocedure,'public.expire_break_glass_sessions()'::regprocedure,'public.refresh_warranty_and_maintenance_status()'::regprocedure,'public.collect_sync_customer(text)'::regprocedure,'public.fc_refresh_order(uuid)'::regprocedure,'public.fc_upsert_case(text,text,text,uuid,uuid,uuid,text,text,numeric,text,boolean)'::regprocedure,'public.dl_upsert(text,text,uuid,text,text,timestamptz,text,text,text,jsonb)'::regprocedure,'public.sys_health_autofix()'::regprocedure] LOOP
  IF has_function_privilege('anon',f,'EXECUTE') OR has_function_privilege('authenticated',f,'EXECUTE') OR NOT has_function_privilege('service_role',f,'EXECUTE') THEN RAISE EXCEPTION 'Invalid internal helper privileges: %',f; END IF;
 END LOOP;
END $$;
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN PERFORM public.audit_retention_purge(); RAISE EXCEPTION 'Audit purge reachable'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.alixdocs2_purge_deleted(); RAISE EXCEPTION 'Document purge reachable'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.sys_health_autofix(); RAISE EXCEPTION 'Indirect audit purge reachable'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;