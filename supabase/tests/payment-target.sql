DO $test$
DECLARE u uuid; actual integer; expected integer;
BEGIN
 SELECT up.id INTO u FROM public.user_profiles up
 JOIN public.user_roles ur ON ur.user_id=up.id JOIN public.roles r ON r.id=ur.role_id
 WHERE up.is_active AND up.account_status='active' AND r.name='Super Admin' LIMIT 1;
 IF u IS NULL THEN RAISE EXCEPTION 'Testkonto fehlt'; END IF;
 PERFORM set_config('request.jwt.claim.sub',u::text,true);
 SELECT count(*) INTO actual FROM public.fibu_light_due_date_changes();
 SELECT count(DISTINCT a.invoice_id) INTO expected FROM public.invoice_audit_log a
 JOIN public.fibu_light_open_items() i ON i.id=a.invoice_id
 JOIN public.zoho_invoices z ON z.id=i.id
 WHERE a.action='DUE_DATE_CHANGE' AND public.tenant_scope_id_ok(z.tenant_id);
 IF actual<>expected THEN RAISE EXCEPTION 'Geschützte Fälligkeitsvermerke fehlen'; END IF;
 IF EXISTS(SELECT 1 FROM public.fibu_light_due_date_changes() c
   WHERE NOT EXISTS(SELECT 1 FROM public.fibu_light_open_items() i WHERE i.id=c.invoice_id)) THEN
   RAISE EXCEPTION 'Unzugängliche Rechnung ausgegeben';
 END IF;
 PERFORM set_config('request.jwt.claim.sub','',true);
 BEGIN
   PERFORM public.fibu_light_due_date_changes();
   RAISE EXCEPTION 'Anonymer Abruf akzeptiert';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 RAISE NOTICE 'PASS: autorisierte Vermerke vollständig, Rechnungszugriff eingehalten, anonym gesperrt';
END $test$;