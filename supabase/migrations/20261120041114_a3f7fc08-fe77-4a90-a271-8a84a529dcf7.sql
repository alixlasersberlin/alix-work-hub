DO $$ DECLARE u uuid; i public.zoho_invoices%ROWTYPE; j public.zoho_invoices%ROWTYPE; result jsonb; d date; BEGIN
 SELECT up.id INTO u FROM public.user_profiles up JOIN public.user_roles ur ON ur.user_id=up.id JOIN public.roles r ON r.id=ur.role_id WHERE up.is_active AND up.account_status='active' AND r.name='Super Admin' LIMIT 1;
 IF u IS NULL THEN RAISE EXCEPTION 'Testkonto fehlt'; END IF;
 PERFORM set_config('request.jwt.claim.sub',u::text,true);
 BEGIN PERFORM public.fibu_light_set_due_date(gen_random_uuid(),NULL,NULL); RAISE EXCEPTION 'Datum fehlt akzeptiert'; EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE '%gültige Fälligkeit%' THEN RAISE; END IF; END;
 SELECT * INTO i FROM public.zoho_invoices WHERE balance>0 AND invoice_date IS NOT NULL AND lower(coalesce(status,'')) NOT IN ('draft','entwurf','void','storniert','cancelled') AND public.tenant_scope_id_ok(tenant_id) AND public.gobd_period_state(accounting_region,invoice_date)<>'hard_locked' LIMIT 1;
 IF i.id IS NULL THEN RAISE EXCEPTION 'Keine testbare Rechnung'; END IF;
 d:=greatest(coalesce(i.due_date,current_date),i.invoice_date)+1;
 BEGIN
  result:=public.fibu_light_set_due_date(i.id,d,i.due_date);
  SELECT * INTO j FROM public.zoho_invoices WHERE id=i.id;
  IF j.due_date<>d OR j.total IS DISTINCT FROM i.total OR j.balance IS DISTINCT FROM i.balance OR j.invoice_number IS DISTINCT FROM i.invoice_number THEN RAISE EXCEPTION 'Fälligkeitsregel verletzt'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.invoice_audit_log WHERE invoice_id=i.id AND action='DUE_DATE_CHANGE' AND metadata->>'new_due_date'=d::text) THEN RAISE EXCEPTION 'Protokoll fehlt'; END IF;
  result:=public.fibu_light_set_due_date(i.id,d,i.due_date);
  IF NOT coalesce((result->>'unchanged')::boolean,false) THEN RAISE EXCEPTION 'Wiederholung nicht unverändert'; END IF;
  RAISE EXCEPTION 'TEST_ROLLBACK';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'TEST_ROLLBACK' THEN RAISE; END IF;
 END;
 SELECT * INTO j FROM public.zoho_invoices WHERE id=i.id;
 IF j.due_date IS DISTINCT FROM i.due_date THEN RAISE EXCEPTION 'Testrücknahme fehlgeschlagen'; END IF;
 PERFORM set_config('request.jwt.claim.sub','',true);
 BEGIN PERFORM public.fibu_light_set_due_date(i.id,d,i.due_date); RAISE EXCEPTION 'Anonym erlaubt'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;