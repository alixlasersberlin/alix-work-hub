CREATE OR REPLACE FUNCTION public.revision_settle_case(p_case jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE v_tx public.bank_transactions%ROWTYPE; v_invoice record; v_id uuid; v_table text; v_paid numeric; v_date date; v_balance numeric; v_returned numeric; v_later numeric; v_return_date date;
BEGIN
 IF NOT public.is_admin() OR NOT EXISTS(SELECT 1 FROM public.user_profiles WHERE id=auth.uid() AND is_active AND account_status='active') THEN RAISE EXCEPTION 'Keine Berechtigung für REVISION' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_tx FROM public.bank_transactions WHERE id=(p_case->>'transaction_id')::uuid FOR UPDATE;
 IF NOT FOUND OR NOT public.tenant_scope_id_ok(v_tx.tenant_id) THEN RAISE EXCEPTION 'Bankbeleg nicht zugänglich'; END IF;
 IF p_case->>'category'='duplicate' THEN RAISE EXCEPTION 'Doppelte Zuordnungen zuerst berichtigen. Kein Rechnungsausgleich.'; END IF;
 v_id:=nullif(p_case->>'invoice_id','')::uuid;
 IF v_id IS NULL THEN
   SELECT (array_agg(DISTINCT invoice_id))[1]::uuid INTO v_id FROM public.bank_transaction_allocations WHERE bank_transaction_id=v_tx.id AND allocation_type IN ('rechnung','invoice') HAVING count(DISTINCT invoice_id)=1;
 END IF;
 IF v_id IS NULL THEN RAISE EXCEPTION 'Keine eindeutige Rechnung zugeordnet. Zahlung zuerst unter Buchung öffnen prüfen und verbuchen.'; END IF;
 SELECT id,total,balance,currency,tenant_id,status INTO v_invoice FROM public.zoho_invoices WHERE id=v_id FOR UPDATE;
 v_table:='zoho_invoices';
 IF NOT FOUND THEN
   SELECT id,total,balance,currency,tenant_id,status INTO v_invoice FROM public.zoho_recurring_invoices WHERE id=v_id FOR UPDATE;
   v_table:='zoho_recurring_invoices';
 END IF;
 IF NOT FOUND OR NOT public.tenant_scope_id_ok(v_invoice.tenant_id) THEN RAISE EXCEPTION 'Rechnung nicht zugänglich'; END IF;
 IF v_tx.currency IS DISTINCT FROM v_invoice.currency OR v_tx.tenant_id IS DISTINCT FROM v_invoice.tenant_id THEN RAISE EXCEPTION 'Mandant oder Währung des Belegs passt nicht eindeutig zur Rechnung'; END IF;
 IF lower(coalesce(v_invoice.status,'')) IN ('draft','entwurf','void','storniert','cancelled') THEN RAISE EXCEPTION 'Entwürfe und stornierte Rechnungen dürfen nicht ausgeglichen werden'; END IF;
 PERFORM b.id FROM public.bank_transactions b JOIN public.bank_transaction_allocations a ON a.bank_transaction_id=b.id WHERE a.invoice_id=v_id::text ORDER BY b.id FOR UPDATE OF b;
 PERFORM a.id FROM public.bank_transaction_allocations a WHERE a.invoice_id=v_id::text FOR UPDATE;
 IF EXISTS(SELECT 1 FROM public.bank_transactions b JOIN public.bank_transaction_allocations a ON a.bank_transaction_id=b.id WHERE a.invoice_id=v_id::text AND b.status IN ('verbucht','allocated') AND NOT coalesce(b.is_return_debit,false) AND (a.currency IS DISTINCT FROM v_invoice.currency OR b.currency IS DISTINCT FROM v_invoice.currency OR b.tenant_id IS DISTINCT FROM v_invoice.tenant_id)) THEN RAISE EXCEPTION 'Zahlungsnachweise mit abweichendem Mandant oder Währung'; END IF;
 IF EXISTS(SELECT 1 FROM public.bank_transactions b WHERE b.id IN (SELECT bank_transaction_id FROM public.bank_transaction_allocations WHERE invoice_id=v_id::text) AND b.status IN ('verbucht','allocated') AND NOT coalesce(b.is_return_debit,false) AND (SELECT coalesce(sum(a.allocated_amount),0) FROM public.bank_transaction_allocations a WHERE a.bank_transaction_id=b.id)>abs(b.amount)+0.009) THEN RAISE EXCEPTION 'Überzuordnung oder doppelte Zahlung: zuerst berichtigen'; END IF;
 SELECT coalesce(sum(a.allocated_amount),0),max(b.booking_date) FILTER(WHERE a.allocated_amount>0) INTO v_paid,v_date FROM public.bank_transaction_allocations a JOIN public.bank_transactions b ON b.id=a.bank_transaction_id WHERE a.invoice_id=v_id::text AND a.currency=v_invoice.currency AND b.currency=v_invoice.currency AND b.tenant_id IS NOT DISTINCT FROM v_invoice.tenant_id AND b.status IN ('verbucht','allocated') AND NOT coalesce(b.is_return_debit,false) AND a.allocation_type IN ('rechnung','invoice','gegenbuchung','ruecklastschrift');
 IF v_paid<=0 THEN RAISE EXCEPTION 'Keine netto verbuchte Zahlung belegt. Rechnung bleibt unverändert.'; END IF;
 SELECT coalesce(sum(a.allocated_amount),0),max(r.booking_date) INTO v_returned,v_return_date FROM public.bank_return_debit_allocations a JOIN public.bank_return_debits r ON r.id=a.return_debit_id WHERE a.invoice_id=v_id::text AND r.status IN ('bestaetigt','mahnprozess','erledigt');
 IF v_returned>0 THEN
 SELECT coalesce(sum(a.allocated_amount),0) INTO v_later FROM public.bank_transaction_allocations a JOIN public.bank_transactions b ON b.id=a.bank_transaction_id WHERE a.invoice_id=v_id::text AND b.status IN ('verbucht','allocated') AND NOT coalesce(b.is_return_debit,false) AND b.booking_date>v_return_date AND a.currency=v_invoice.currency AND b.currency=v_invoice.currency AND b.tenant_id IS NOT DISTINCT FROM v_invoice.tenant_id AND a.allocation_type IN ('rechnung','invoice','gegenbuchung','ruecklastschrift');
 IF v_later<v_returned-0.009 THEN RAISE EXCEPTION 'Rücklastschrift ohne ausreichenden späteren Zahlungseingang. Kein Abschluss.'; END IF;
 v_paid:=least(v_paid,v_later);
 END IF;
 v_balance:=round(least(greatest(coalesce(v_invoice.balance,0),0),greatest(v_invoice.total-v_paid,0)),2);
 EXECUTE format('UPDATE public.%I SET balance=$1,payment_status=CASE WHEN $1<=0.009 THEN ''paid'' ELSE ''partially_paid'' END,status=CASE WHEN $1<=0.009 THEN ''paid'' ELSE status END,last_payment_date=greatest(last_payment_date,$2) WHERE id=$3',v_table) USING v_balance,v_date,v_id;
 RETURN jsonb_build_object('invoice_id',v_id,'old_balance',v_invoice.balance,'balance',v_balance,'paid_evidence',v_paid,'settled',true,'fully_paid',v_balance<=0.009);
END $$;
REVOKE ALL ON FUNCTION public.revision_settle_case(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.revision_settle_case(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.revision_review(p_case_key text,p_status text,p_note text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE c jsonb; event_id uuid; settlement jsonb:='{}'::jsonb; prior jsonb;
BEGIN
 IF NOT public.is_admin() OR NOT EXISTS(SELECT 1 FROM public.user_profiles WHERE id=auth.uid() AND is_active AND account_status='active') THEN RAISE EXCEPTION 'Keine Berechtigung für REVISION' USING ERRCODE='42501'; END IF;
 IF p_status IS NULL OR p_status NOT IN ('open','in_progress','clarification','reviewed') THEN RAISE EXCEPTION 'Ungültiger Prüfstatus'; END IF;
 IF length(btrim(coalesce(p_note,'')))<5 OR length(p_note)>4000 THEN RAISE EXCEPTION 'Prüfnotiz muss 5 bis 4000 Zeichen enthalten'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('revision:'||p_case_key,0));
 SELECT new_value INTO prior FROM public.bank_audit_log WHERE action='REVISION_REVIEW' AND new_value->>'case_key'=p_case_key AND public.tenant_scope_id_ok(tenant_id) AND new_value->>'settled'='true' ORDER BY created_at DESC LIMIT 1;
 IF p_status='reviewed' AND prior IS NOT NULL THEN RETURN prior||jsonb_build_object('already_processed',true); END IF;
 SELECT value INTO c FROM jsonb_array_elements(public.revision_cases()) WHERE value->>'case_key'=p_case_key LIMIT 1;
 IF c IS NULL THEN RAISE EXCEPTION 'Fall ist nicht mehr vorhanden oder nicht zugänglich' USING ERRCODE='42501'; END IF;
 IF p_status='reviewed' THEN settlement:=public.revision_settle_case(c); END IF;
 INSERT INTO public.bank_audit_log(tenant_id,bank_transaction_id,action,new_value,user_id,user_email) VALUES((c->>'tenant_id')::uuid,(c->>'transaction_id')::uuid,'REVISION_REVIEW',jsonb_build_object('case_key',p_case_key,'status',p_status,'note',btrim(p_note),'category',c->>'category')||settlement,auth.uid(),(SELECT email FROM public.user_profiles WHERE id=auth.uid())) RETURNING id INTO event_id;
 RETURN jsonb_build_object('id',event_id,'status',p_status)||settlement;
END $$;