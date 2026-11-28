DO $patch$
DECLARE s text; d text; old text;
BEGIN
 FOREACH s IN ARRAY ARRAY['public.set_factory_invoice_pdf(uuid,text)','public.clear_factory_invoice_pdf(uuid)','public.set_factory_invoice_payment_ok(uuid,boolean)'] LOOP
  SELECT pg_get_functiondef(s::regprocedure) INTO d;old:=d;
  d:=replace(d,' AND (o.tenant_id IS NULL OR public.has_tenant_access(o.tenant_id))','');
  IF d=old OR position('public.has_tenant_access(o.tenant_id)' IN d)>0 THEN RAISE EXCEPTION 'Production source correction mismatch: %',s; END IF; EXECUTE d;
 END LOOP;
 SELECT pg_get_functiondef('sec_private.fc_order_financials(uuid)'::regprocedure) INTO d;old:=d;
 d:=replace(d,' AND i.tenant_id IS NOT DISTINCT FROM o.tenant_id','');
 IF d=old OR position('o.tenant_id' IN d)>0 THEN RAISE EXCEPTION 'Financial source correction mismatch'; END IF; EXECUTE d;
END $patch$;