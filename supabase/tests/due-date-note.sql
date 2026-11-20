DO $test$
DECLARE u uuid; i public.zoho_invoices%ROWTYPE; d date; before_count integer;
BEGIN
 SELECT up.id INTO u FROM public.user_profiles up JOIN public.user_roles ur ON ur.user_id=up.id
 JOIN public.roles r ON r.id=ur.role_id WHERE up.is_active AND up.account_status='active' AND r.name='Super Admin' LIMIT 1;
 IF u IS NULL THEN RAISE EXCEPTION 'Testkonto fehlt'; END IF;
 PERFORM set_config('request.jwt.claim.sub',u::text,true);
 SELECT * INTO i FROM public.zoho_invoices WHERE balance>0 AND tenant_scope_id_ok(tenant_id)
 AND lower(coalesce(status,'')) NOT IN ('draft','entwurf','void','storniert','cancelled')
 AND invoice_date IS NOT NULL AND gobd_period_state(accounting_region,invoice_date)<>'hard_locked' LIMIT 1;
 IF i.id IS NULL THEN RAISE EXCEPTION 'Testrechnung fehlt'; END IF;
 d:=greatest(coalesce(i.due_date,i.invoice_date),i.invoice_date)+1;
 SELECT count(*) INTO before_count FROM public.op_light_notes WHERE invoice_id=i.id;
 BEGIN
  PERFORM public.fibu_light_set_due_date_with_note(i.id,d,i.due_date,'QA vereinbartes Zahlungsziel');
  IF NOT EXISTS(SELECT 1 FROM public.op_light_notes WHERE invoice_id=i.id AND created_by=u
   AND note='Fälligkeit geändert auf '||to_char(d,'DD.MM.YYYY')||' · QA vereinbartes Zahlungsziel') THEN
   RAISE EXCEPTION 'Bemerkung oder Autor fehlt';
  END IF;
  PERFORM public.fibu_light_set_due_date_with_note(i.id,d,i.due_date,'QA vereinbartes Zahlungsziel');
  IF (SELECT count(*) FROM public.op_light_notes WHERE invoice_id=i.id)<>before_count+1 THEN
   RAISE EXCEPTION 'Wiederholung erzeugt doppelte Notiz';
  END IF;
  RAISE EXCEPTION 'QA_ROLLBACK';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'QA_ROLLBACK' THEN RAISE; END IF; END;
 IF (SELECT due_date FROM public.zoho_invoices WHERE id=i.id) IS DISTINCT FROM i.due_date
 OR (SELECT count(*) FROM public.op_light_notes WHERE invoice_id=i.id)<>before_count THEN RAISE EXCEPTION 'Testrücknahme fehlgeschlagen'; END IF;
 BEGIN
  PERFORM public.fibu_light_set_due_date_with_note(i.id,d,i.due_date,repeat('x',2001));
  RAISE EXCEPTION 'Längenlimit fehlt';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Bemerkung darf höchstens%' THEN RAISE; END IF; END;
END $test$;