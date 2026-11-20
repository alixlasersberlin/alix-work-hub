CREATE OR REPLACE FUNCTION public.fibu_light_set_due_date(p_invoice_id uuid,p_due_date date,p_expected_due_date date) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE i public.zoho_invoices%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL OR NOT public.can_use_fibu_light() OR NOT EXISTS(SELECT 1 FROM public.user_profiles WHERE id=auth.uid() AND is_active AND account_status='active') THEN RAISE EXCEPTION 'Keine Berechtigung zur Fälligkeitsänderung.' USING ERRCODE='42501'; END IF;
 IF p_due_date IS NULL OR NOT isfinite(p_due_date) THEN RAISE EXCEPTION 'Bitte eine gültige Fälligkeit auswählen.'; END IF;
 SELECT * INTO i FROM public.zoho_invoices WHERE id=p_invoice_id FOR UPDATE;
 IF NOT FOUND OR NOT public.tenant_scope_id_ok(i.tenant_id) THEN RAISE EXCEPTION 'Rechnung nicht zugänglich.' USING ERRCODE='42501'; END IF;
 IF coalesce(i.balance,0)<=0 OR lower(coalesce(i.status,'')) IN ('draft','entwurf','void','storniert','cancelled') THEN RAISE EXCEPTION 'Nur offene ausgestellte Rechnungen dürfen geändert werden.'; END IF;
 IF p_due_date<i.invoice_date THEN RAISE EXCEPTION 'Fälligkeit darf nicht vor dem Rechnungsdatum liegen.'; END IF;
 IF i.invoice_date IS NOT NULL AND public.gobd_period_state(i.accounting_region,i.invoice_date)='hard_locked' THEN RAISE EXCEPTION 'Rechnungsperiode ist gesperrt.'; END IF;
 IF i.due_date=p_due_date THEN RETURN jsonb_build_object('due_date',i.due_date,'unchanged',true); END IF;
 IF i.due_date IS DISTINCT FROM p_expected_due_date THEN RAISE EXCEPTION 'Fälligkeit wurde zwischenzeitlich geändert. Bitte aktualisieren.'; END IF;
 PERFORM set_config('fibu.due_date_op','on',true);
 UPDATE public.zoho_invoices SET due_date=p_due_date WHERE id=i.id;
 PERFORM set_config('fibu.due_date_op','off',true);
 INSERT INTO public.invoice_audit_log(invoice_id,invoice_number,tenant_id,user_id,action,fields,metadata) VALUES(i.id,coalesce(i.legal_invoice_number,i.invoice_number),i.tenant_id,auth.uid(),'DUE_DATE_CHANGE',ARRAY['due_date'],jsonb_build_object('old_due_date',i.due_date,'new_due_date',p_due_date));
 PERFORM public.log_audit_event('FIBU_LIGHT_DUE_DATE_CHANGE','fibu-light',i.id::text,jsonb_build_object('old_due_date',i.due_date,'new_due_date',p_due_date),NULL,NULL);
 RETURN jsonb_build_object('due_date',p_due_date);
END $$;
REVOKE ALL ON FUNCTION public.fibu_light_set_due_date(uuid,date,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fibu_light_set_due_date(uuid,date,date) TO authenticated;
DO $$ DECLARE d text; marker text := '  -- Kontrollierte Vergabe/Korrektur der gesetzlichen Rechnungsnummer'; BEGIN
 d:=pg_get_functiondef('public.gobd_invoice_guard()'::regprocedure);
 IF position(marker in d)=0 THEN RAISE EXCEPTION 'Guard marker missing'; END IF;
 d:=replace(d,marker,$branch$
  IF v_changed = ARRAY['due_date']::text[] AND NOT v_locked
     AND current_setting('fibu.due_date_op',true)='on'
     AND auth.uid() IS NOT NULL AND public.can_use_fibu_light()
     AND public.tenant_scope_id_ok(OLD.tenant_id)
     AND EXISTS(SELECT 1 FROM public.user_profiles WHERE id=auth.uid() AND is_active AND account_status='active')
  THEN RETURN NEW; END IF;
$branch$ || marker);
 EXECUTE d;
END $$;
CREATE OR REPLACE FUNCTION public.fibu_preserve_due_date() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE d date;
BEGIN
 IF NEW.due_date IS DISTINCT FROM OLD.due_date AND public.gobd_is_service_context() AND coalesce(current_setting('fibu.due_date_op',true),'off')<>'on' THEN
  SELECT (metadata->>'new_due_date')::date INTO d FROM public.invoice_audit_log WHERE invoice_id=OLD.id AND action='DUE_DATE_CHANGE' ORDER BY created_at DESC,id DESC LIMIT 1;
  IF FOUND THEN NEW.due_date:=d; END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.fibu_preserve_due_date() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER aaa_fibu_preserve_due_date BEFORE UPDATE ON public.zoho_invoices FOR EACH ROW EXECUTE FUNCTION public.fibu_preserve_due_date();