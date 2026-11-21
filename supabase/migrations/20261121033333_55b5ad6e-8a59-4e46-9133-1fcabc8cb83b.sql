DO $qa$
DECLARE v_user uuid; v_admin uuid; v_invoice public.zoho_invoices%ROWTYPE; v_due date; v_failed boolean:=false;
BEGIN
 SELECT up.id INTO v_admin FROM public.user_profiles up JOIN public.user_roles ur ON ur.user_id=up.id JOIN public.roles r ON r.id=ur.role_id WHERE up.is_active AND up.account_status='active' AND r.name='Super Admin' LIMIT 1;
 SELECT up.id INTO v_user FROM public.user_profiles up WHERE up.is_active AND up.account_status='active' AND NOT EXISTS(SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id=ur.role_id WHERE ur.user_id=up.id AND r.name IN ('Super Admin','Admin')) LIMIT 1;
 IF v_user IS NULL OR v_admin IS NULL THEN RAISE EXCEPTION 'Testkonto fehlt'; END IF;
 BEGIN
  PERFORM set_config('request.jwt.claim.sub',v_admin::text,true);
  INSERT INTO public.user_roles(user_id,role_id) SELECT v_user,id FROM public.roles WHERE name='FIBU LIGHT' ON CONFLICT DO NOTHING;
  PERFORM set_config('request.jwt.claim.sub',v_user::text,true);
  SELECT * INTO v_invoice FROM public.zoho_invoices WHERE balance>0 AND public.tenant_scope_id_ok(tenant_id) AND lower(coalesce(status,'')) NOT IN ('draft','entwurf','void','storniert','cancelled') AND (invoice_date IS NULL OR public.gobd_period_state(accounting_region,invoice_date)<>'hard_locked') ORDER BY id LIMIT 1;
  IF v_invoice.id IS NULL THEN RAISE EXCEPTION 'Testrechnung fehlt'; END IF;
  v_due:=greatest(coalesce(v_invoice.due_date,current_date),coalesce(v_invoice.invoice_date,current_date))+1;
  PERFORM set_config('role','authenticated',true);
  IF current_user<>'authenticated' OR public.is_admin() OR NOT public.can_use_fibu_light() THEN RAISE EXCEPTION 'Testrechte falsch'; END IF;
  BEGIN
   PERFORM public.fibu_light_set_due_date_with_note(v_invoice.id,v_due,v_invoice.due_date,'QA RLS Test');
  EXCEPTION WHEN insufficient_privilege THEN
   IF SQLERRM<>'Rechnung nicht zugänglich.' THEN RAISE; END IF;
   v_failed:=true;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'Gemeldeter Fehler nicht reproduziert'; END IF;
  RAISE EXCEPTION 'QA_ROLLBACK' USING ERRCODE='P0002';
 EXCEPTION WHEN SQLSTATE 'P0002' THEN
  IF SQLERRM<>'QA_ROLLBACK' THEN RAISE; END IF;
 END;
 RAISE NOTICE 'PASS: Nichtadmin mit FIBU LIGHT scheitert unter authenticated an Rechnung nicht zugänglich; alle Teständerungen zurückgenommen';
END $qa$;