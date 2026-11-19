CREATE OR REPLACE FUNCTION public.fibu_light_book_payment(p_invoice_id uuid,p_amount numeric,p_payment_date date,p_method text DEFAULT 'Bank',p_reference text DEFAULT NULL,p_note text DEFAULT NULL,p_full boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_inv public.zoho_invoices%ROWTYPE; v_amount numeric; v_balance numeric; v_tx uuid; v_evidence text; v_key uuid; v_prior jsonb; v_note jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT public.can_use_fibu_light() OR NOT EXISTS(SELECT 1 FROM public.user_profiles WHERE id=auth.uid() AND is_active AND account_status='active') THEN RAISE EXCEPTION 'Keine Berechtigung für manuelle Zahlungsbuchungen.' USING ERRCODE='42501'; END IF;
 BEGIN v_note:=p_note::jsonb; EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'Zahlungsnachweis erforderlich.'; END;
 v_evidence:=btrim(coalesce(v_note->>'evidence',''));
 IF length(v_evidence)<5 OR length(v_evidence)>2000 THEN RAISE EXCEPTION 'Zahlungsnachweis mit 5 bis 2000 Zeichen erforderlich.'; END IF;
 BEGIN v_key:=(v_note->>'request_id')::uuid; EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'Ungültige Buchungskennung.'; END;
 IF v_key IS NULL THEN RAISE EXCEPTION 'Buchungskennung erforderlich.'; END IF;
 IF p_payment_date IS NULL OR p_payment_date>current_date THEN RAISE EXCEPTION 'Gültiges Zahlungsdatum bis heute erforderlich.'; END IF;
 IF p_method IS NULL OR p_method NOT IN ('Bank','Bar','Karte','Sonstige') THEN RAISE EXCEPTION 'Ungültige Zahlungsart.'; END IF;
 IF p_amount IS NULL OR p_amount<=0 OR p_amount::text IN ('NaN','Infinity','-Infinity') OR p_amount<>round(p_amount,2) THEN RAISE EXCEPTION 'Positiver Zahlbetrag mit höchstens zwei Nachkommastellen erforderlich.'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text||v_key::text,0));
 SELECT * INTO v_inv FROM public.zoho_invoices WHERE id=p_invoice_id FOR UPDATE;
 IF NOT FOUND OR NOT public.tenant_scope_id_ok(v_inv.tenant_id) THEN RAISE EXCEPTION 'Rechnung nicht zugänglich.' USING ERRCODE='42501'; END IF;
 SELECT details INTO v_prior FROM public.audit_logs WHERE user_id=auth.uid() AND action='FIBU_LIGHT_PAYMENT' AND details->>'request_id'=v_key::text ORDER BY created_at DESC LIMIT 1;
 IF v_prior IS NOT NULL THEN
  IF v_prior->>'invoice_id' IS DISTINCT FROM p_invoice_id::text OR (v_prior->>'amount')::numeric IS DISTINCT FROM p_amount OR v_prior->>'payment_date' IS DISTINCT FROM p_payment_date::text OR v_prior->>'evidence' IS DISTINCT FROM v_evidence OR v_prior->>'method' IS DISTINCT FROM p_method THEN RAISE EXCEPTION 'Buchungskennung bereits für andere Zahlungsdaten verwendet.'; END IF;
  RETURN jsonb_build_object('transaction_id',v_prior->>'transaction_id','amount',v_prior->'amount','new_balance',v_prior->'new_balance','closed',(v_prior->>'new_balance')::numeric<=0.009,'already_processed',true);
 END IF;
 IF lower(coalesce(v_inv.status,'')) IN ('draft','entwurf','void','storniert','cancelled') THEN RAISE EXCEPTION 'Entwürfe und Stornos dürfen nicht bebucht werden.'; END IF;
 IF coalesce(v_inv.balance,0)<=0 THEN RAISE EXCEPTION 'Rechnung bereits ausgeglichen.'; END IF;
 v_amount:=round(p_amount,2);
 IF v_amount>v_inv.balance THEN RAISE EXCEPTION 'Zahlbetrag übersteigt offenen Betrag.'; END IF;
 IF p_full AND v_amount<>v_inv.balance THEN RAISE EXCEPTION 'Vollzahlung muss dem aktuellen offenen Betrag entsprechen.'; END IF;
 INSERT INTO public.finance_transactions(amount,currency,booking_date,reference,transaction_type,notes,tenant_id,accounting_region) VALUES(v_amount,coalesce(v_inv.currency,'EUR'),p_payment_date,coalesce(nullif(btrim(p_reference),''),coalesce(v_inv.legal_invoice_number,v_inv.invoice_number)),'Zahlung',concat_ws(' | ','FIBU LIGHT','Zahlungsart: '||p_method,'Rechnung: '||coalesce(v_inv.legal_invoice_number,v_inv.invoice_number),'Zahlungsnachweis: '||v_evidence,nullif(btrim(v_note->>'note'),'')),v_inv.tenant_id,v_inv.accounting_region) RETURNING id INTO v_tx;
 v_balance:=round(greatest(v_inv.balance-v_amount,0),2);
 UPDATE public.zoho_invoices SET balance=v_balance,payment_status=CASE WHEN v_balance<=0.009 THEN 'paid' ELSE 'partially_paid' END,last_payment_date=p_payment_date,status=CASE WHEN v_balance<=0.009 THEN 'paid' ELSE status END,updated_at=now() WHERE id=p_invoice_id RETURNING balance INTO v_balance;
 PERFORM public.log_audit_event('FIBU_LIGHT_PAYMENT','fibu-light',p_invoice_id::text,jsonb_build_object('invoice_id',p_invoice_id,'invoice_number',coalesce(v_inv.legal_invoice_number,v_inv.invoice_number),'amount',v_amount,'method',p_method,'reference',p_reference,'payment_date',p_payment_date,'old_balance',v_inv.balance,'new_balance',v_balance,'transaction_id',v_tx,'evidence',v_evidence,'request_id',v_key),NULL,NULL);
 RETURN jsonb_build_object('transaction_id',v_tx,'amount',v_amount,'new_balance',v_balance,'closed',v_balance<=0.009);
END $$;
REVOKE ALL ON FUNCTION public.fibu_light_book_payment(uuid,numeric,date,text,text,text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fibu_light_book_payment(uuid,numeric,date,text,text,text,boolean) TO authenticated;
