DO $qa$
DECLARE
 v_user uuid; v_admin uuid; v_role record; v_invoice public.zoho_invoices%ROWTYPE;
 v_due date; v_result jsonb; v_owner text:=current_user; v_audit integer; v_notes integer;
 v_after public.zoho_invoices%ROWTYPE; v_direct uuid;
BEGIN
 SELECT up.id INTO v_admin FROM public.user_profiles up JOIN public.user_roles ur ON ur.user_id=up.id JOIN public.roles r ON r.id=ur.role_id
 WHERE up.is_active AND up.account_status='active' AND r.name='Super Admin' LIMIT 1;
 SELECT up.id INTO v_user FROM public.user_profiles up WHERE up.is_active AND up.account_status='active'
 AND NOT EXISTS(SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id=ur.role_id WHERE ur.user_id=up.id AND r.name IN ('Super Admin','Admin')) LIMIT 1;
 IF v_user IS NULL OR v_admin IS NULL THEN RAISE EXCEPTION 'Testkonten fehlen'; END IF;
 FOR v_role IN SELECT id,name FROM public.roles WHERE name IN ('FIBU LIGHT','Buchhaltung Admin','Buchhaltung EU','Buchhaltung CH') LOOP
  BEGIN
   PERFORM set_config('request.jwt.claim.sub',v_admin::text,true);
   INSERT INTO public.user_roles(user_id,role_id) VALUES(v_user,v_role.id) ON CONFLICT DO NOTHING;
   PERFORM set_config('request.jwt.claim.sub',v_user::text,true);
   SELECT * INTO v_invoice FROM public.zoho_invoices
   WHERE balance>0 AND public.tenant_scope_id_ok(tenant_id)
   AND lower(coalesce(status,'')) NOT IN ('draft','entwurf','void','storniert','cancelled')
   AND (invoice_date IS NULL OR public.gobd_period_state(accounting_region,invoice_date)<>'hard_locked') ORDER BY id LIMIT 1;
   IF v_invoice.id IS NULL THEN RAISE EXCEPTION 'Testrechnung fehlt'; END IF;
   v_due:=greatest(coalesce(v_invoice.due_date,current_date),coalesce(v_invoice.invoice_date,current_date))+1;
   SELECT count(*) INTO v_audit FROM public.invoice_audit_log WHERE invoice_id=v_invoice.id AND action='DUE_DATE_CHANGE';
   SELECT count(*) INTO v_notes FROM public.op_light_notes WHERE invoice_id=v_invoice.id;
   PERFORM set_config('role','authenticated',true);
   IF current_user<>'authenticated' OR public.is_admin() OR NOT public.can_use_fibu_light() THEN RAISE EXCEPTION 'Testrechte falsch'; END IF;
   SELECT id INTO v_direct FROM public.zoho_invoices WHERE id=v_invoice.id FOR UPDATE;
   IF v_direct IS NOT NULL THEN RAISE EXCEPTION 'Allgemeiner Rechnungszugriff erweitert'; END IF;
   v_result:=public.fibu_light_set_due_date_with_note(v_invoice.id,v_due,v_invoice.due_date,'QA RLS Zahlungsziel');
   IF (v_result->>'due_date')::date IS DISTINCT FROM v_due THEN RAISE EXCEPTION 'Fälligkeit nicht gespeichert'; END IF;
   v_result:=public.fibu_light_set_due_date_with_note(v_invoice.id,v_due,v_invoice.due_date,'QA RLS Zahlungsziel');
   IF NOT coalesce((v_result->>'unchanged')::boolean,false) THEN RAISE EXCEPTION 'Wiederholung nicht erkannt'; END IF;
   BEGIN
    PERFORM public.fibu_light_set_due_date(v_invoice.id,v_due+1,v_invoice.due_date);
    RAISE EXCEPTION 'Veraltete Fälligkeit akzeptiert';
   EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Fälligkeit wurde zwischenzeitlich geändert.%' THEN RAISE; END IF;
   END;
   PERFORM set_config('role',v_owner,true);
   SELECT * INTO v_after FROM public.zoho_invoices WHERE id=v_invoice.id;
   IF v_after.due_date IS DISTINCT FROM v_due OR (to_jsonb(v_after)-ARRAY['due_date','updated_at']) IS DISTINCT FROM (to_jsonb(v_invoice)-ARRAY['due_date','updated_at']) THEN
    RAISE EXCEPTION 'Fälligkeit oder unveränderliche Rechnungswerte falsch';
   END IF;
   IF (SELECT count(*) FROM public.invoice_audit_log WHERE invoice_id=v_invoice.id AND action='DUE_DATE_CHANGE')<>v_audit+1
    OR (SELECT count(*) FROM public.op_light_notes WHERE invoice_id=v_invoice.id)<>v_notes+1 THEN RAISE EXCEPTION 'Protokoll oder Notiz doppelt/fehlend'; END IF;
   IF NOT EXISTS(SELECT 1 FROM public.invoice_audit_log WHERE invoice_id=v_invoice.id AND user_id=v_user AND action='DUE_DATE_CHANGE'
     AND metadata->>'new_due_date'=v_due::text) THEN RAISE EXCEPTION 'Autor oder Datum im Protokoll falsch'; END IF;
   PERFORM set_config('role','authenticated',true);
   PERFORM set_config('request.jwt.claim.sub','',true);
   BEGIN
    PERFORM public.fibu_light_set_due_date(v_invoice.id,v_due+1,v_due);
    RAISE EXCEPTION 'Nicht angemeldeten Zugriff akzeptiert';
   EXCEPTION WHEN insufficient_privilege THEN NULL;
   END;
   RAISE EXCEPTION 'QA_ROLLBACK' USING ERRCODE='P0002';
  EXCEPTION WHEN SQLSTATE 'P0002' THEN
   IF SQLERRM<>'QA_ROLLBACK' THEN RAISE; END IF;
  END;
  IF (SELECT due_date FROM public.zoho_invoices WHERE id=v_invoice.id) IS DISTINCT FROM v_invoice.due_date THEN RAISE EXCEPTION 'Teständerung nicht zurückgenommen'; END IF;
  RAISE NOTICE 'PASS: % unter authenticated; Fälligkeit, Notiz, Autor, Wiederholung, Konflikt und Zugriffssperre; vollständig zurückgenommen',v_role.name;
 END LOOP;
END $qa$;