DO $patch$
DECLARE s text; d text; old text; gate text;
BEGIN
 gate:=$g$
  IF NOT coalesce(public.is_internal_user(),false) THEN RAISE EXCEPTION 'Keine aktive interne Berechtigung' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.production_orders po LEFT JOIN public.orders o ON o.id=po.order_id WHERE po.id=_production_order_id AND ((po.tenant_id IS NOT NULL AND public.has_tenant_access(po.tenant_id)) OR (po.tenant_id IS NULL AND public.source_to_tenant_code(o.source_system)=ANY(public.user_tenant_codes()) AND (o.tenant_id IS NULL OR public.has_tenant_access(o.tenant_id)))) AND (o.id IS NULL OR public.source_to_tenant_code(o.source_system)=ANY(public.user_tenant_codes()))) THEN RAISE EXCEPTION 'Produktionsauftrag nicht zugänglich' USING ERRCODE='42501'; END IF;
$g$;
 FOREACH s IN ARRAY ARRAY['public.set_factory_invoice_pdf(uuid,text)','public.clear_factory_invoice_pdf(uuid)','public.set_factory_invoice_payment_ok(uuid,boolean)'] LOOP
  SELECT pg_get_functiondef(s::regprocedure) INTO d;old:=d;
  d:=replace(d,'BEGIN'||chr(10),'BEGIN'||chr(10)||gate);
  IF d=old THEN RAISE EXCEPTION 'Factory scope patch mismatch: %',s; END IF; EXECUTE d;
 END LOOP;

 gate:=$g$
  IF NOT public.gobd_is_service_context() AND NOT coalesce(cardinality(public.user_tenant_codes())>0 AND (public.has_role('Super Admin') OR public.has_role('Admin') OR public.has_role('Buchhaltung Admin') OR public.has_role('Buchhaltung EU') OR public.has_role('Buchhaltung CH')),false) THEN RAISE EXCEPTION 'Keine aktive GoBD-Prüfberechtigung' USING ERRCODE='42501'; END IF;
$g$;
 FOREACH s IN ARRAY ARRAY['public.gobd_compliance_check()','public.gobd_phase13_check()','public.gobd_phase14_check()'] LOOP
  SELECT pg_get_functiondef(s::regprocedure) INTO d;old:=d;
  d:=replace(d,'BEGIN'||chr(10),'BEGIN'||chr(10)||gate);
  IF d=old THEN RAISE EXCEPTION 'GoBD scope patch mismatch: %',s; END IF; EXECUTE d;
  EXECUTE format('ALTER FUNCTION %s SECURITY INVOKER',s);
 END LOOP;
END $patch$;

ALTER FUNCTION public.check_delivery_readiness(uuid) SECURITY INVOKER;
ALTER FUNCTION sec_private.check_delivery_readiness(uuid) SECURITY INVOKER;
GRANT EXECUTE ON FUNCTION sec_private.check_delivery_readiness(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION sec_private.check_delivery_readiness(uuid) FROM PUBLIC,anon;
REVOKE EXECUTE ON FUNCTION public.gobd_log_retention_event(text,text,text,uuid,uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gobd_log_retention_event(text,text,text,uuid,uuid,text,jsonb) TO service_role;

DO $negative$
DECLARE saved text:=current_setting('request.jwt.claims',true);
BEGIN
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',gen_random_uuid(),'role','authenticated')::text,true);
 BEGIN PERFORM public.set_factory_invoice_pdf(gen_random_uuid(),'unused'); RAISE EXCEPTION 'Unprivileged factory reference accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.clear_factory_invoice_pdf(gen_random_uuid()); RAISE EXCEPTION 'Unprivileged factory reference removal accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.set_factory_invoice_payment_ok(gen_random_uuid(),true); RAISE EXCEPTION 'Unprivileged factory payment accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.gobd_compliance_check(); RAISE EXCEPTION 'Unprivileged compliance accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.gobd_phase13_check(); RAISE EXCEPTION 'Unprivileged phase13 accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.gobd_phase14_check(); RAISE EXCEPTION 'Unprivileged phase14 accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM set_config('request.jwt.claims',coalesce(saved,''),true);
 IF has_function_privilege('authenticated','public.gobd_log_retention_event(text,text,text,uuid,uuid,text,jsonb)','EXECUTE') OR NOT has_function_privilege('service_role','public.gobd_log_retention_event(text,text,text,uuid,uuid,text,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'Retention audit ACL regression'; END IF;
END $negative$;