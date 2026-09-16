
CREATE OR REPLACE FUNCTION public.fibu_light_bank_confirm(
  p_transaction_id uuid, p_allocations jsonb, p_overpay text DEFAULT 'guthaben', p_source text DEFAULT 'vorschlag')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tx public.bank_transactions%ROWTYPE; v_existing numeric; v_sum numeric := 0;
  v_rest numeric; a jsonb; v_inv public.zoho_invoices%ROWTYPE; v_amt numeric; v_res jsonb;
  v_booked jsonb := '[]'::jsonb; v_first_customer text; v_first_name text; v_ref text; v_multi boolean;
BEGIN
  IF NOT public.can_use_fibu_light() THEN RAISE EXCEPTION 'Keine Berechtigung fuer FIBU LIGHT.'; END IF;
  IF p_allocations IS NULL OR jsonb_array_length(p_allocations) = 0 THEN
    RAISE EXCEPTION 'Keine Zuordnung uebergeben.';
  END IF;
  v_multi := jsonb_array_length(p_allocations) > 1;

  SELECT * INTO v_tx FROM public.bank_transactions WHERE id = p_transaction_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bankumsatz nicht gefunden.'; END IF;

  SELECT coalesce(sum(al.allocated_amount),0) INTO v_existing
  FROM public.bank_transaction_allocations al
  WHERE al.bank_transaction_id = p_transaction_id AND al.reversal_of IS NULL;

  IF v_existing > 0.009 THEN
    INSERT INTO public.op_light_bank_audit (transaction_id, action, bank_amount, source, result, note)
    VALUES (p_transaction_id, 'abgewiesen', v_tx.amount, p_source, 'BUCHUNG ABGEWIESEN',
            'Banktransaktion bereits zugeordnet.');
    RAISE EXCEPTION 'BUCHUNG ABGEWIESEN: Banktransaktion bereits zugeordnet.';
  END IF;

  FOR a IN SELECT * FROM jsonb_array_elements(p_allocations) LOOP
    v_sum := v_sum + round(coalesce((a->>'amount')::numeric, 0), 2);
  END LOOP;
  IF v_sum <= 0 THEN RAISE EXCEPTION 'Zuordnungsbetrag muss groesser als 0 sein.'; END IF;
  IF v_sum > round(coalesce(v_tx.amount,0),2) + 0.009 THEN
    RAISE EXCEPTION 'Die Summe der Zuordnungen (%) uebersteigt den Bankeingang (%).', v_sum, v_tx.amount;
  END IF;

  v_rest := round(coalesce(v_tx.amount,0) - v_sum, 2);
  IF v_rest > 0.009 AND coalesce(p_overpay,'guthaben') NOT IN ('guthaben','klaeren') THEN
    RAISE EXCEPTION 'Restbetrag % nicht entschieden.', v_rest;
  END IF;

  FOR a IN SELECT * FROM jsonb_array_elements(p_allocations) LOOP
    SELECT * INTO v_inv FROM public.zoho_invoices WHERE id = (a->>'invoice_id')::uuid;
    IF NOT FOUND THEN RAISE EXCEPTION 'Rechnung nicht gefunden.'; END IF;
    v_amt := round(coalesce((a->>'amount')::numeric,0), 2);
    IF v_first_customer IS NULL THEN v_first_customer := v_inv.customer_id; v_first_name := v_inv.customer_name; END IF;

    -- eindeutige Referenz je Rechnung (Sammelzahlung!)
    v_ref := left(concat_ws(' / ',
               coalesce(nullif(btrim(coalesce(v_tx.end_to_end_reference,'')),''),
                        nullif(btrim(coalesce(v_tx.bank_reference,'')),''),
                        nullif(left(btrim(coalesce(v_tx.purpose,'')), 40),''),
                        'BANK'),
               coalesce(v_inv.legal_invoice_number, v_inv.invoice_number, v_inv.id::text),
               left(p_transaction_id::text, 8)), 120);

    v_res := public.fibu_light_book_payment(
      v_inv.id, v_amt, coalesce(v_tx.value_date, v_tx.booking_date, current_date), 'Bank',
      v_ref, 'Bankzuordnung FIBU LIGHT · Transaktion ' || p_transaction_id::text, false);

    INSERT INTO public.bank_transaction_allocations
      (bank_transaction_id, invoice_id, invoice_number, allocation_type, allocated_amount, currency, note, created_by)
    VALUES (p_transaction_id, v_inv.id::text, coalesce(v_inv.legal_invoice_number, v_inv.invoice_number),
            'invoice', v_amt, coalesce(v_tx.currency,'EUR'), 'FIBU LIGHT', auth.uid());

    INSERT INTO public.op_light_bank_audit
      (transaction_id, action, invoice_id, invoice_number, customer_name, bank_amount, booked_amount,
       prev_balance, new_balance, matching_score, matching_reasons, source, result, note)
    VALUES (p_transaction_id, 'zugeordnet', v_inv.id, coalesce(v_inv.legal_invoice_number, v_inv.invoice_number),
            v_inv.customer_name, v_tx.amount, v_amt, v_inv.balance, (v_res->>'new_balance')::numeric,
            nullif(a->>'score','')::integer, a->'reasons', p_source, 'ZUGEORDNET',
            CASE WHEN v_multi THEN 'Sammelzahlung · Referenz ' || v_ref ELSE 'Referenz ' || v_ref END);

    v_booked := v_booked || jsonb_build_object('invoice_id', v_inv.id, 'amount', v_amt,
                                               'new_balance', (v_res->>'new_balance')::numeric);
  END LOOP;

  IF v_rest > 0.009 THEN
    INSERT INTO public.op_light_bank_credits (transaction_id, customer_id, customer_name, amount, currency, note, status)
    VALUES (p_transaction_id, v_first_customer, v_first_name, v_rest, coalesce(v_tx.currency,'EUR'),
            'Ueberzahlung aus Bankzuordnung', CASE WHEN p_overpay = 'klaeren' THEN 'klaerung' ELSE 'ungeklaert' END);
    INSERT INTO public.op_light_bank_audit (transaction_id, action, bank_amount, booked_amount, source, result, note)
    VALUES (p_transaction_id, 'ueberzahlung', v_tx.amount, v_rest, p_source, 'GUTHABEN OFFEN',
            'Restbetrag als ungeklaertes Kundenguthaben erfasst.');
  END IF;

  UPDATE public.bank_transactions
     SET status = 'allocated',
         matched_invoice_id = (p_allocations->0->>'invoice_id'),
         matching_score = coalesce(nullif(p_allocations->0->>'score','')::integer, matching_score, 0),
         updated_at = now()
   WHERE id = p_transaction_id;

  RETURN jsonb_build_object('transaction_id', p_transaction_id, 'allocated', v_sum,
                            'rest', v_rest, 'bookings', v_booked);
END; $$;
REVOKE EXECUTE ON FUNCTION public.fibu_light_bank_confirm(uuid, jsonb, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fibu_light_bank_confirm(uuid, jsonb, text, text) TO authenticated;
