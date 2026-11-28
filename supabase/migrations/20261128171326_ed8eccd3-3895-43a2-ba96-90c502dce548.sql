REVOKE EXECUTE ON FUNCTION public.finance_deposit_recalc(uuid), public.next_invoice_number(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finance_deposit_recalc(uuid), public.next_invoice_number(date) TO service_role;

DO $patch$
DECLARE d text; old text; gate text;
BEGIN
 SELECT pg_get_functiondef('public.assign_invoice_number(uuid)'::regprocedure) INTO d;
 old := d;
 d := replace(d, 'BEGIN' || chr(10), 'BEGIN' || chr(10) || $g$
  IF auth.role() IS DISTINCT FROM 'service_role' AND NOT (auth.uid() IS NULL AND coalesce(auth.role(),'') NOT IN ('anon','authenticated') AND session_user IN ('postgres','supabase_admin')) THEN
   IF NOT coalesce(public.is_admin() AND cardinality(public.user_tenant_codes())>0,false) THEN RAISE EXCEPTION 'Keine Berechtigung zur Rechnungsnummernvergabe' USING ERRCODE='42501'; END IF;
  END IF;
$g$);
 gate := $g$
  IF auth.role() IS DISTINCT FROM 'service_role' AND NOT (auth.uid() IS NULL AND coalesce(auth.role(),'') NOT IN ('anon','authenticated') AND session_user IN ('postgres','supabase_admin')) THEN
   IF NOT coalesce(public.source_to_tenant_code(v_inv.source_system)=ANY(public.user_tenant_codes()),false) OR (v_inv.tenant_id IS NOT NULL AND NOT coalesce(public.has_tenant_access(v_inv.tenant_id),false)) THEN RAISE EXCEPTION 'Rechnung außerhalb der freigegebenen Firma' USING ERRCODE='42501'; END IF;
  END IF;
$g$;
 d := replace(d, '  IF v_inv.legal_invoice_number IS NOT NULL THEN', gate || chr(10) || '  IF v_inv.legal_invoice_number IS NOT NULL THEN');
 IF d=old OR position('Rechnung außerhalb' IN d)=0 THEN RAISE EXCEPTION 'assign_invoice_number patch mismatch'; END IF; EXECUTE d;

 SELECT pg_get_functiondef('public.create_invoice_correction(uuid,text,text,uuid)'::regprocedure) INTO d; old:=d;
 gate := $g$
  IF NOT coalesce(public.can_access_finance() AND cardinality(public.user_tenant_codes())>0,false) THEN RAISE EXCEPTION 'Keine Berechtigung für Rechnungskorrekturen' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.zoho_invoices i WHERE i.id=_original_invoice_id AND public.source_to_tenant_code(i.source_system)=ANY(public.user_tenant_codes()) AND (i.tenant_id IS NULL OR public.has_tenant_access(i.tenant_id))) THEN RAISE EXCEPTION 'Rechnung nicht zugänglich' USING ERRCODE='42501'; END IF;
  IF _correction_invoice_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.zoho_invoices i JOIN public.zoho_invoices o ON o.id=_original_invoice_id WHERE i.id=_correction_invoice_id AND i.source_system IS NOT DISTINCT FROM o.source_system AND i.tenant_id IS NOT DISTINCT FROM o.tenant_id AND public.source_to_tenant_code(i.source_system)=ANY(public.user_tenant_codes()) AND (i.tenant_id IS NULL OR public.has_tenant_access(i.tenant_id))) THEN RAISE EXCEPTION 'Korrekturrechnung nicht zugänglich oder andere Firma' USING ERRCODE='42501'; END IF;
$g$;
 d:=replace(d,'BEGIN'||chr(10),'BEGIN'||chr(10)||gate);
 IF d=old THEN RAISE EXCEPTION 'create_invoice_correction patch mismatch'; END IF; EXECUTE d;

 SELECT pg_get_functiondef('public.create_credit_note(uuid,numeric,numeric,text)'::regprocedure) INTO d; old:=d;
 d:=replace(d,'SELECT id, total INTO v_inv FROM public.zoho_invoices WHERE id = _original_invoice_id;', 'SELECT id, total, tenant_id, source_system INTO v_inv FROM public.zoho_invoices WHERE id = _original_invoice_id FOR UPDATE;');
 gate:=$g$
  IF NOT coalesce(public.can_access_finance() AND cardinality(public.user_tenant_codes())>0,false) THEN RAISE EXCEPTION 'Keine aktive Finanzberechtigung' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.zoho_invoices i WHERE i.id=_original_invoice_id AND public.source_to_tenant_code(i.source_system)=ANY(public.user_tenant_codes()) AND (i.tenant_id IS NULL OR public.has_tenant_access(i.tenant_id))) THEN RAISE EXCEPTION 'Rechnung nicht zugänglich' USING ERRCODE='42501'; END IF;
$g$;
 d:=replace(d,'BEGIN'||chr(10),'BEGIN'||chr(10)||gate);
 IF d=old OR position('FOR UPDATE;' IN d)=0 THEN RAISE EXCEPTION 'create_credit_note patch mismatch'; END IF; EXECUTE d;

 SELECT pg_get_functiondef('public.gobd_log_invoice_event(uuid,text,text,uuid,text[],jsonb)'::regprocedure) INTO d; old:=d;
 gate:=$g$
  IF NOT coalesce(public.is_internal_user(),false) THEN RAISE EXCEPTION 'Keine aktive interne Berechtigung' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.zoho_invoices i WHERE i.id=_invoice_id AND public.source_to_tenant_code(i.source_system)=ANY(public.user_tenant_codes()) AND (i.tenant_id IS NULL OR public.has_tenant_access(i.tenant_id))) THEN RAISE EXCEPTION 'Rechnung nicht zugänglich' USING ERRCODE='42501'; END IF;
  IF _related_invoice_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.zoho_invoices i JOIN public.zoho_invoices o ON o.id=_invoice_id WHERE i.id=_related_invoice_id AND i.source_system IS NOT DISTINCT FROM o.source_system AND i.tenant_id IS NOT DISTINCT FROM o.tenant_id AND public.source_to_tenant_code(i.source_system)=ANY(public.user_tenant_codes()) AND (i.tenant_id IS NULL OR public.has_tenant_access(i.tenant_id))) THEN RAISE EXCEPTION 'Verknüpfte Rechnung nicht zugänglich' USING ERRCODE='42501'; END IF;
$g$;
 d:=replace(d,'BEGIN'||chr(10),'BEGIN'||chr(10)||gate);
 IF d=old THEN RAISE EXCEPTION 'gobd_log_invoice_event patch mismatch'; END IF; EXECUTE d;

 SELECT pg_get_functiondef('public.mark_credit_note_sent(uuid,text)'::regprocedure) INTO d; old:=d;
 gate:=$g$
  IF NOT coalesce(public.can_access_finance() AND cardinality(public.user_tenant_codes())>0,false) THEN RAISE EXCEPTION 'Keine aktive Finanzberechtigung' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.invoice_corrections c JOIN public.zoho_invoices i ON i.id=c.original_invoice_id WHERE c.id=_id AND c.correction_type='gutschrift' AND public.source_to_tenant_code(i.source_system)=ANY(public.user_tenant_codes()) AND (i.tenant_id IS NULL OR public.has_tenant_access(i.tenant_id))) THEN RAISE EXCEPTION 'Gutschrift nicht zugänglich' USING ERRCODE='42501'; END IF;
$g$;
 d:=replace(d,'BEGIN'||chr(10),'BEGIN'||chr(10)||gate);
 IF d=old THEN RAISE EXCEPTION 'mark_credit_note_sent patch mismatch'; END IF; EXECUTE d;
END $patch$;

ALTER FUNCTION public.ac_wfm_adherence_live() SECURITY INVOKER;
ALTER FUNCTION sec_private.ac_wfm_adherence_live() SECURITY INVOKER;
ALTER FUNCTION public.alixdocs2_fts_search(text,integer) SECURITY INVOKER;
ALTER FUNCTION sec_private.alixdocs2_fts_search(text,integer) SECURITY INVOKER;
GRANT USAGE ON SCHEMA sec_private TO authenticated;
GRANT EXECUTE ON FUNCTION sec_private.ac_wfm_adherence_live(), sec_private.alixdocs2_fts_search(text,integer) TO authenticated;
REVOKE EXECUTE ON FUNCTION sec_private.ac_wfm_adherence_live(), sec_private.alixdocs2_fts_search(text,integer) FROM PUBLIC, anon;

DO $assert$
DECLARE s text;
BEGIN
 FOREACH s IN ARRAY ARRAY['public.finance_deposit_recalc(uuid)','public.next_invoice_number(date)'] LOOP
  IF has_function_privilege('authenticated',s,'EXECUTE') OR has_function_privilege('anon',s,'EXECUTE') OR NOT has_function_privilege('service_role',s,'EXECUTE') THEN RAISE EXCEPTION 'Internal ACL regression: %',s; END IF;
 END LOOP;
 FOREACH s IN ARRAY ARRAY['public.ac_wfm_adherence_live()','sec_private.ac_wfm_adherence_live()','public.alixdocs2_fts_search(text,integer)','sec_private.alixdocs2_fts_search(text,integer)'] LOOP
  IF (SELECT prosecdef FROM pg_proc WHERE oid=s::regprocedure) THEN RAISE EXCEPTION 'Reader still bypasses RLS: %',s; END IF;
 END LOOP;
END $assert$;

DO $negative$
DECLARE saved text:=current_setting('request.jwt.claims',true); u uuid:=gen_random_uuid();
BEGIN
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
 BEGIN PERFORM public.assign_invoice_number(gen_random_uuid()); RAISE EXCEPTION 'Unprivileged numbering accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.create_invoice_correction(gen_random_uuid(),'storno','security regression'); RAISE EXCEPTION 'Unprivileged correction accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.create_credit_note(gen_random_uuid(),1,19,'security regression'); RAISE EXCEPTION 'Unprivileged credit accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.gobd_log_invoice_event(gen_random_uuid(),'INVOICE_CREATED'); RAISE EXCEPTION 'Unprivileged audit accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.mark_credit_note_sent(gen_random_uuid(),'unused@example.invalid'); RAISE EXCEPTION 'Unprivileged credit state accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM set_config('request.jwt.claims',coalesce(saved,''),true);
END $negative$;