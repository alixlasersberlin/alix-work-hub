-- Execute as a privileged test runner. All test payments are rolled back inside
-- the exception subtransaction; the outer transaction can also be rolled back.
DO $test$
DECLARE
  v_user uuid; v_invoices uuid[]; v_balances numeric[];
  v_tx uuid := gen_random_uuid(); v_result jsonb; v_count integer; v_index integer;
  v_key uuid; v_evidence text;
BEGIN
  SELECT up.id INTO v_user FROM public.user_profiles up
  JOIN public.user_roles ur ON ur.user_id=up.id JOIN public.roles r ON r.id=ur.role_id
  WHERE up.is_active AND up.account_status='active' AND r.name='Super Admin' LIMIT 1;
  IF v_user IS NULL THEN RAISE EXCEPTION 'Testkonto fehlt'; END IF;
  PERFORM set_config('request.jwt.claim.sub',v_user::text,true);
  SELECT array_agg(id ORDER BY id), array_agg(balance ORDER BY id)
    INTO v_invoices,v_balances
  FROM (SELECT id,balance FROM public.zoho_invoices
    WHERE balance>=0.02 AND currency='EUR' AND public.tenant_scope_id_ok(tenant_id)
      AND lower(coalesce(status,'')) NOT IN ('draft','entwurf','void','storniert','cancelled')
      AND (invoice_date IS NULL OR public.gobd_period_state(accounting_region,invoice_date)<>'hard_locked')
    ORDER BY id LIMIT 2) eligible;
  IF coalesce(array_length(v_invoices,1),0)<>2 THEN RAISE EXCEPTION 'Zwei geeignete Testrechnungen fehlen'; END IF;
  BEGIN
    INSERT INTO public.bank_transactions(id,tenant_id,amount,currency,booking_date,value_date,bank_reference)
      SELECT v_tx,tenant_id,0.02,'EUR',current_date,current_date,'QA-BANK-MATCH'
      FROM public.zoho_invoices WHERE id=v_invoices[1];
    v_result:=public.fibu_light_bank_confirm(v_tx,jsonb_build_array(
      jsonb_build_object('invoice_id',v_invoices[1],'amount',0.01),
      jsonb_build_object('invoice_id',v_invoices[2],'amount',0.01)),'guthaben','qa-regression');
    IF (v_result->>'allocated')::numeric<>0.02 OR jsonb_array_length(v_result->'bookings')<>2 THEN
      RAISE EXCEPTION 'Sammelzahlung nicht vollständig gebucht';
    END IF;
    FOR v_index IN 1..2 LOOP
      IF (SELECT balance FROM public.zoho_invoices WHERE id=v_invoices[v_index])<>v_balances[v_index]-0.01 THEN
        RAISE EXCEPTION 'Rechnungssaldo nicht exakt einmal reduziert';
      END IF;
      v_key:=md5('fibu-light-bank:'||v_tx::text||':'||v_invoices[v_index]::text)::uuid;
      SELECT count(*),min(details->>'evidence') INTO v_count,v_evidence FROM public.audit_logs
        WHERE user_id=v_user AND action='FIBU_LIGHT_PAYMENT' AND details->>'request_id'=v_key::text;
      IF v_count<>1 OR v_evidence NOT LIKE '%'||v_tx::text||'%' OR length(v_evidence)<5 THEN
        RAISE EXCEPTION 'Eindeutiger Bankzahlungsnachweis fehlt';
      END IF;
    END LOOP;
    IF (SELECT count(*) FROM public.bank_transaction_allocations WHERE bank_transaction_id=v_tx)<>2
       OR (SELECT status FROM public.bank_transactions WHERE id=v_tx)<>'allocated' THEN
      RAISE EXCEPTION 'Bankzuordnung nicht gespeichert';
    END IF;
    BEGIN
      PERFORM public.fibu_light_bank_confirm(v_tx,jsonb_build_array(
        jsonb_build_object('invoice_id',v_invoices[1],'amount',0.01)));
      RAISE EXCEPTION 'Doppelte Bankzuordnung akzeptiert';
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM NOT LIKE 'BUCHUNG ABGEWIESEN:%' THEN RAISE; END IF;
    END;
    RAISE EXCEPTION 'QA_ROLLBACK';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'QA_ROLLBACK' THEN RAISE; END IF;
  END;
  IF EXISTS(SELECT 1 FROM public.bank_transactions WHERE id=v_tx)
     OR EXISTS(SELECT 1 FROM public.bank_transaction_allocations WHERE bank_transaction_id=v_tx)
     OR EXISTS(SELECT 1 FROM public.audit_logs WHERE action='FIBU_LIGHT_PAYMENT'
       AND details->>'request_id' IN (
         md5('fibu-light-bank:'||v_tx::text||':'||v_invoices[1]::text)::uuid::text,
         md5('fibu-light-bank:'||v_tx::text||':'||v_invoices[2]::text)::uuid::text)) THEN
    RAISE EXCEPTION 'Testbuchungen nicht zurückgenommen';
  END IF;
  FOR v_index IN 1..2 LOOP
    IF (SELECT balance FROM public.zoho_invoices WHERE id=v_invoices[v_index])<>v_balances[v_index] THEN
      RAISE EXCEPTION 'Rechnungssaldo nach Test verändert';
    END IF;
  END LOOP;
  RAISE NOTICE 'PASS: Bankzahlung, Sammelzahlung, Belegnachweis, Duplikatsperre und Rücknahme';
END $test$;