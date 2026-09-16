
CREATE OR REPLACE FUNCTION public.fibu_light_bank_suggestions(p_transaction_id uuid, p_limit integer DEFAULT 5)
RETURNS TABLE(invoice_id uuid, invoice_number text, customer_id text, customer_name text,
              invoice_total numeric, open_amount numeric, due_date date, currency text,
              score integer, reasons jsonb, suggested_amount numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tx public.bank_transactions%ROWTYPE; v_ref text; v_known_invoice text; v_known_customer text;
BEGIN
  IF NOT public.can_use_fibu_light() THEN RAISE EXCEPTION 'Keine Berechtigung fuer FIBU LIGHT.'; END IF;
  SELECT * INTO v_tx FROM public.bank_transactions WHERE id = p_transaction_id;
  IF NOT FOUND THEN RETURN; END IF;

  v_ref := public.op_light_norm_ref(concat_ws(' ', v_tx.purpose, v_tx.end_to_end_reference,
                                              v_tx.customer_reference, v_tx.invoice_number_hint, v_tx.booking_text));

  IF coalesce(v_tx.sender_receiver_iban,'') <> '' THEN
    SELECT a.invoice_id INTO v_known_invoice
    FROM public.bank_transaction_allocations a
    JOIN public.bank_transactions b ON b.id = a.bank_transaction_id
    WHERE b.sender_receiver_iban = v_tx.sender_receiver_iban AND a.reversal_of IS NULL
    ORDER BY a.created_at DESC LIMIT 1;
    IF v_known_invoice IS NOT NULL THEN
      SELECT z.customer_id INTO v_known_customer FROM public.zoho_invoices z WHERE z.id::text = v_known_invoice;
    END IF;
  END IF;

  RETURN QUERY
  WITH cand AS (
    SELECT i.id, coalesce(i.legal_invoice_number, i.invoice_number) AS num, i.customer_id,
           i.customer_name, i.total, i.balance, i.due_date, i.currency,
           public.op_light_norm_ref(coalesce(i.legal_invoice_number, i.invoice_number)) AS nnum,
           public.op_light_norm_ref(coalesce(i.invoice_number, '')) AS nalt,
           (v_known_customer IS NOT NULL AND i.customer_id = v_known_customer) AS iban_known
    FROM public.zoho_invoices i
    WHERE coalesce(i.balance,0) > 0.009
      AND lower(coalesce(i.status,'')) NOT IN ('draft','entwurf','void','storniert','cancelled')
  ), scored AS (
    SELECT c.*,
      (CASE WHEN length(c.nnum) >= 5 AND v_ref LIKE '%' || c.nnum || '%' THEN 60
            WHEN length(c.nalt) >= 5 AND v_ref LIKE '%' || c.nalt || '%' THEN 60
            WHEN length(c.nnum) >= 6 AND v_ref LIKE '%' || right(c.nnum, 6) || '%' THEN 25 ELSE 0 END) AS sc_num,
      (CASE WHEN abs(coalesce(v_tx.amount,0) - coalesce(c.balance,0)) < 0.01 THEN 30
            WHEN abs(coalesce(v_tx.amount,0) - coalesce(c.total,0)) < 0.01 THEN 20
            WHEN coalesce(v_tx.amount,0) < coalesce(c.balance,0) THEN 8
            WHEN abs(coalesce(v_tx.amount,0) - coalesce(c.balance,0)) <= greatest(25, coalesce(c.balance,0)*0.01) THEN 6
            ELSE 0 END) AS sc_amt,
      (CASE WHEN lower(coalesce(v_tx.sender_receiver_name,'')) = lower(coalesce(c.customer_name,'')) THEN 15
            WHEN coalesce(v_tx.sender_receiver_name,'') <> '' AND coalesce(c.customer_name,'') <> ''
                 AND (public.op_light_norm_ref(v_tx.sender_receiver_name) LIKE '%' || public.op_light_norm_ref(split_part(c.customer_name,' ',1)) || '%'
                      OR public.op_light_norm_ref(c.customer_name) LIKE '%' || public.op_light_norm_ref(split_part(v_tx.sender_receiver_name,' ',1)) || '%')
                 AND length(public.op_light_norm_ref(split_part(c.customer_name,' ',1))) >= 4 THEN 10
            ELSE 0 END) AS sc_cust,
      (CASE WHEN c.iban_known THEN 10 ELSE 0 END) AS sc_iban
    FROM cand c
  )
  SELECT s.id, s.num, s.customer_id, s.customer_name, s.total, s.balance, s.due_date,
         coalesce(s.currency,'EUR'), least(s.sc_num + s.sc_amt + s.sc_cust + s.sc_iban, 99)::integer,
         to_jsonb(ARRAY(SELECT x FROM unnest(ARRAY[
           CASE WHEN s.sc_num >= 60 THEN 'Rechnungsnummer im Verwendungszweck erkannt'
                WHEN s.sc_num > 0 THEN 'Teil der Rechnungsnummer im Verwendungszweck' END,
           CASE WHEN abs(coalesce(v_tx.amount,0) - coalesce(s.balance,0)) < 0.01 THEN 'Betrag entspricht exakt dem offenen Betrag' END,
           CASE WHEN abs(coalesce(v_tx.amount,0) - coalesce(s.total,0)) < 0.01 AND abs(coalesce(v_tx.amount,0) - coalesce(s.balance,0)) >= 0.01 THEN 'Betrag entspricht dem Rechnungsbetrag' END,
           CASE WHEN coalesce(v_tx.amount,0) < coalesce(s.balance,0) THEN 'Moegliche Teilzahlung' END,
           CASE WHEN coalesce(v_tx.amount,0) > coalesce(s.balance,0) + 0.009 THEN 'Betrag hoeher als offener Betrag (Ueberzahlung pruefen)' END,
           CASE WHEN s.sc_cust >= 15 THEN 'Kundenname stimmt ueberein'
                WHEN s.sc_cust > 0 THEN 'Kundenname aehnlich' END,
           CASE WHEN s.iban_known THEN 'Bankverbindung bereits bekannt' END
         ]) x WHERE x IS NOT NULL)),
         round(least(coalesce(v_tx.amount,0), coalesce(s.balance,0)), 2)
  FROM scored s
  WHERE (s.sc_num + s.sc_amt + s.sc_cust + s.sc_iban) > 0
  ORDER BY (s.sc_num + s.sc_amt + s.sc_cust + s.sc_iban) DESC, s.due_date NULLS LAST
  LIMIT greatest(coalesce(p_limit,5), 1);
END; $$;
REVOKE EXECUTE ON FUNCTION public.fibu_light_bank_suggestions(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fibu_light_bank_suggestions(uuid, integer) TO authenticated;
