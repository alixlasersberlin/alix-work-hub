
-- ============ FIBU LIGHT PHASE 3: Bank & Zuordnung (additiv) ============

-- Normalisierung von Referenzen (Rechnungsnummern in Verwendungszwecken)
CREATE OR REPLACE FUNCTION public.op_light_norm_ref(p text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT upper(regexp_replace(coalesce(p,''), '[^0-9A-Za-z]', '', 'g'));
$$;

-- 1) Protokoll der bestätigten / abgelehnten Zuordnungen (append-only)
CREATE TABLE IF NOT EXISTS public.op_light_bank_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL,
  action text NOT NULL,
  invoice_id uuid,
  invoice_number text,
  customer_name text,
  bank_amount numeric,
  booked_amount numeric,
  prev_balance numeric,
  new_balance numeric,
  matching_score integer,
  matching_reasons jsonb,
  source text,
  result text,
  note text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.op_light_bank_audit TO authenticated;
GRANT ALL ON public.op_light_bank_audit TO service_role;
ALTER TABLE public.op_light_bank_audit ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bank audit lesbar fuer fibu light" ON public.op_light_bank_audit;
CREATE POLICY "bank audit lesbar fuer fibu light" ON public.op_light_bank_audit
  FOR SELECT TO authenticated USING (public.can_use_fibu_light());

-- 2) Klärungsfälle zu Bankumsätzen (append-only)
CREATE TABLE IF NOT EXISTS public.op_light_bank_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL,
  action text NOT NULL DEFAULT 'unklar',
  reason text,
  note text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.op_light_bank_cases TO authenticated;
GRANT ALL ON public.op_light_bank_cases TO service_role;
ALTER TABLE public.op_light_bank_cases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bank cases lesbar fuer fibu light" ON public.op_light_bank_cases;
CREATE POLICY "bank cases lesbar fuer fibu light" ON public.op_light_bank_cases
  FOR SELECT TO authenticated USING (public.can_use_fibu_light());

-- 3) Ungeklaerte Kundenguthaben aus Ueberzahlungen (append-only, keine Verrechnung)
CREATE TABLE IF NOT EXISTS public.op_light_bank_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL,
  customer_id text,
  customer_name text,
  amount numeric NOT NULL,
  currency text DEFAULT 'EUR',
  status text NOT NULL DEFAULT 'ungeklaert',
  note text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.op_light_bank_credits TO authenticated;
GRANT ALL ON public.op_light_bank_credits TO service_role;
ALTER TABLE public.op_light_bank_credits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bank credits lesbar fuer fibu light" ON public.op_light_bank_credits;
CREATE POLICY "bank credits lesbar fuer fibu light" ON public.op_light_bank_credits
  FOR SELECT TO authenticated USING (public.can_use_fibu_light());

-- Unveraenderbarkeit
DROP TRIGGER IF EXISTS trg_op_light_bank_audit_immutable ON public.op_light_bank_audit;
CREATE TRIGGER trg_op_light_bank_audit_immutable BEFORE UPDATE OR DELETE ON public.op_light_bank_audit
  FOR EACH ROW EXECUTE FUNCTION public.op_light_immutable();
DROP TRIGGER IF EXISTS trg_op_light_bank_cases_immutable ON public.op_light_bank_cases;
CREATE TRIGGER trg_op_light_bank_cases_immutable BEFORE UPDATE OR DELETE ON public.op_light_bank_cases
  FOR EACH ROW EXECUTE FUNCTION public.op_light_immutable();
DROP TRIGGER IF EXISTS trg_op_light_bank_credits_immutable ON public.op_light_bank_credits;
CREATE TRIGGER trg_op_light_bank_credits_immutable BEFORE UPDATE OR DELETE ON public.op_light_bank_credits
  FOR EACH ROW EXECUTE FUNCTION public.op_light_immutable();

-- Doppelbuchungsschutz erfolgt serverseitig (Satzsperre + Pruefung vorhandener Zuordnungen);
-- kein eindeutiger Index, um historische Daten unveraendert zu lassen.
CREATE INDEX IF NOT EXISTS idx_bta_tx ON public.bank_transaction_allocations (bank_transaction_id);
CREATE INDEX IF NOT EXISTS idx_op_light_bank_audit_tx ON public.op_light_bank_audit (transaction_id);
CREATE INDEX IF NOT EXISTS idx_op_light_bank_cases_tx ON public.op_light_bank_cases (transaction_id);

-- ============ Vorschlaege / Scoring ============
CREATE OR REPLACE FUNCTION public.fibu_light_bank_suggestions(p_transaction_id uuid, p_limit integer DEFAULT 5)
RETURNS TABLE(invoice_id uuid, invoice_number text, customer_id text, customer_name text,
              invoice_total numeric, open_amount numeric, due_date date, currency text,
              score integer, reasons jsonb, suggested_amount numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tx public.bank_transactions%ROWTYPE; v_ref text; v_known_customer text;
BEGIN
  IF NOT public.can_use_fibu_light() THEN RAISE EXCEPTION 'Keine Berechtigung fuer FIBU LIGHT.'; END IF;
  SELECT * INTO v_tx FROM public.bank_transactions WHERE id = p_transaction_id;
  IF NOT FOUND THEN RETURN; END IF;

  v_ref := public.op_light_norm_ref(concat_ws(' ', v_tx.purpose, v_tx.end_to_end_reference,
                                              v_tx.customer_reference, v_tx.invoice_number_hint, v_tx.booking_text));

  -- Kunde ueber bereits frueher eindeutig zugeordnete IBAN (nur Zusatzsignal)
  IF coalesce(v_tx.sender_receiver_iban,'') <> '' THEN
    SELECT a.invoice_id INTO v_known_customer
    FROM public.bank_transaction_allocations a
    JOIN public.bank_transactions b ON b.id = a.bank_transaction_id
    WHERE b.sender_receiver_iban = v_tx.sender_receiver_iban AND a.reversal_of IS NULL
    ORDER BY a.created_at DESC LIMIT 1;
  END IF;

  RETURN QUERY
  WITH cand AS (
    SELECT i.id, coalesce(i.legal_invoice_number, i.invoice_number) AS num, i.customer_id,
           i.customer_name, i.total, i.balance, i.due_date, i.currency,
           public.op_light_norm_ref(coalesce(i.legal_invoice_number, i.invoice_number)) AS nnum,
           (v_known_customer IS NOT NULL AND i.customer_id = (
              SELECT z.customer_id FROM public.zoho_invoices z WHERE z.id::text = v_known_customer)) AS iban_known
    FROM public.zoho_invoices i
    WHERE coalesce(i.balance,0) > 0.009
      AND lower(coalesce(i.status,'')) NOT IN ('draft','entwurf','void','storniert','cancelled')
  ), scored AS (
    SELECT c.*,
      (CASE WHEN length(c.nnum) >= 5 AND v_ref LIKE '%' || c.nnum || '%' THEN 60
            WHEN length(c.nnum) >= 6 AND v_ref LIKE '%' || right(c.nnum, 6) || '%' THEN 25 ELSE 0 END)
      + (CASE WHEN abs(coalesce(v_tx.amount,0) - coalesce(c.balance,0)) < 0.01 THEN 30
              WHEN abs(coalesce(v_tx.amount,0) - coalesce(c.total,0)) < 0.01 THEN 20
              WHEN coalesce(v_tx.amount,0) < coalesce(c.balance,0) THEN 8
              WHEN abs(coalesce(v_tx.amount,0) - coalesce(c.balance,0)) <= greatest(25, coalesce(c.balance,0)*0.01) THEN 6
              ELSE 0 END)
      + (CASE WHEN lower(coalesce(v_tx.sender_receiver_name,'')) = lower(coalesce(c.customer_name,'')) THEN 15
              WHEN coalesce(v_tx.sender_receiver_name,'') <> '' AND coalesce(c.customer_name,'') <> ''
                   AND (public.op_light_norm_ref(v_tx.sender_receiver_name) LIKE '%' || public.op_light_norm_ref(split_part(c.customer_name,' ',1)) || '%'
                        OR public.op_light_norm_ref(c.customer_name) LIKE '%' || public.op_light_norm_ref(split_part(v_tx.sender_receiver_name,' ',1)) || '%')
                   AND length(public.op_light_norm_ref(split_part(c.customer_name,' ',1))) >= 4 THEN 10
              ELSE 0 END)
      + (CASE WHEN c.iban_known THEN 10 ELSE 0 END) AS sc
    FROM cand c
  )
  SELECT s.id, s.num, s.customer_id, s.customer_name, s.total, s.balance, s.due_date,
         coalesce(s.currency,'EUR'), least(s.sc, 99)::integer,
         to_jsonb(ARRAY(SELECT x FROM unnest(ARRAY[
           CASE WHEN length(s.nnum) >= 5 AND v_ref LIKE '%' || s.nnum || '%' THEN 'Rechnungsnummer im Verwendungszweck erkannt' END,
           CASE WHEN abs(coalesce(v_tx.amount,0) - coalesce(s.balance,0)) < 0.01 THEN 'Betrag entspricht exakt dem offenen Betrag' END,
           CASE WHEN abs(coalesce(v_tx.amount,0) - coalesce(s.total,0)) < 0.01 AND abs(coalesce(v_tx.amount,0) - coalesce(s.balance,0)) >= 0.01 THEN 'Betrag entspricht dem Rechnungsbetrag' END,
           CASE WHEN coalesce(v_tx.amount,0) < coalesce(s.balance,0) THEN 'Moegliche Teilzahlung' END,
           CASE WHEN coalesce(v_tx.amount,0) > coalesce(s.balance,0) + 0.009 THEN 'Betrag hoeher als offener Betrag (Ueberzahlung pruefen)' END,
           CASE WHEN lower(coalesce(v_tx.sender_receiver_name,'')) = lower(coalesce(s.customer_name,'')) THEN 'Kundenname stimmt ueberein' END,
           CASE WHEN s.iban_known THEN 'Bankverbindung bereits bekannt' END
         ]) x WHERE x IS NOT NULL)),
         round(least(coalesce(v_tx.amount,0), coalesce(s.balance,0)), 2)
  FROM scored s
  WHERE s.sc > 0
  ORDER BY s.sc DESC, s.due_date NULLS LAST
  LIMIT greatest(coalesce(p_limit,5), 1);
END; $$;

-- ============ Bankumsatzliste ============
CREATE OR REPLACE FUNCTION public.fibu_light_bank_list(p_filter text DEFAULT 'neu', p_search text DEFAULT NULL, p_limit integer DEFAULT 200)
RETURNS TABLE(id uuid, booking_date date, value_date date, amount numeric, currency text,
              sender_name text, sender_iban text, purpose text, bank_account text, status text,
              is_allocated boolean, allocated_amount numeric, case_open boolean, case_reason text,
              best_score integer, best_invoice_id uuid, best_invoice_number text, best_customer_name text,
              best_open_amount numeric, best_reasons jsonb, best_suggested numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.can_use_fibu_light() THEN RAISE EXCEPTION 'Keine Berechtigung fuer FIBU LIGHT.'; END IF;
  RETURN QUERY
  WITH tx AS (
    SELECT b.*, acc.bank_name || coalesce(' · ' || acc.account_name, '') AS acc_label,
           (SELECT coalesce(sum(a.allocated_amount),0) FROM public.bank_transaction_allocations a
             WHERE a.bank_transaction_id = b.id AND a.reversal_of IS NULL) AS alloc,
           (SELECT c.reason FROM public.op_light_bank_cases c WHERE c.transaction_id = b.id
             ORDER BY c.created_at DESC LIMIT 1) AS c_reason,
           (SELECT c.action FROM public.op_light_bank_cases c WHERE c.transaction_id = b.id
             ORDER BY c.created_at DESC LIMIT 1) AS c_action
    FROM public.bank_transactions b
    LEFT JOIN public.bank_accounts acc ON acc.id = b.bank_account_id
    WHERE coalesce(b.amount,0) > 0
      AND coalesce(b.is_duplicate,false) = false
      AND coalesce(b.is_return_debit,false) = false
      AND (p_search IS NULL OR btrim(p_search) = '' OR
           b.purpose ILIKE '%'||p_search||'%' OR b.sender_receiver_name ILIKE '%'||p_search||'%' OR
           b.id::text ILIKE '%'||p_search||'%' OR b.bank_reference ILIKE '%'||p_search||'%' OR
           b.end_to_end_reference ILIKE '%'||p_search||'%' OR b.amount::text ILIKE '%'||p_search||'%')
  ), enriched AS (
    SELECT tx.*, s.invoice_id, s.invoice_number, s.customer_name, s.open_amount, s.score, s.reasons, s.suggested_amount
    FROM tx
    LEFT JOIN LATERAL (
      SELECT * FROM public.fibu_light_bank_suggestions(tx.id, 1)
    ) s ON tx.alloc <= 0.009
  )
  SELECT e.id, e.booking_date, e.value_date, e.amount, coalesce(e.currency,'EUR'),
         e.sender_receiver_name, e.sender_receiver_iban, e.purpose, e.acc_label, e.status,
         (e.alloc > 0.009), e.alloc, (e.c_action = 'unklar'), e.c_reason,
         coalesce(e.score,0)::integer, e.invoice_id, e.invoice_number, e.customer_name,
         e.open_amount, e.reasons, e.suggested_amount
  FROM enriched e
  WHERE CASE coalesce(p_filter,'neu')
          WHEN 'zugeordnet' THEN e.alloc > 0.009
          WHEN 'vorschlag'  THEN e.alloc <= 0.009 AND coalesce(e.score,0) >= 70
          WHEN 'unklar'     THEN e.alloc <= 0.009 AND (coalesce(e.score,0) < 40 OR e.c_action = 'unklar')
          WHEN 'teilzahlung' THEN e.alloc <= 0.009 AND e.open_amount IS NOT NULL AND e.amount < e.open_amount - 0.009
          WHEN 'ueberzahlung' THEN e.alloc <= 0.009 AND e.open_amount IS NOT NULL AND e.amount > e.open_amount + 0.009
          WHEN 'neu'        THEN e.alloc <= 0.009
          ELSE true
        END
  ORDER BY (e.alloc > 0.009), coalesce(e.score,0) DESC, e.booking_date DESC
  LIMIT greatest(coalesce(p_limit,200),1);
END; $$;

-- ============ Sammelzahlung ============
CREATE OR REPLACE FUNCTION public.fibu_light_bank_group_suggestion(p_transaction_id uuid)
RETURNS TABLE(invoice_id uuid, invoice_number text, customer_name text, open_amount numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tx public.bank_transactions%ROWTYPE; v_cust text; v_rest numeric; r record;
BEGIN
  IF NOT public.can_use_fibu_light() THEN RAISE EXCEPTION 'Keine Berechtigung fuer FIBU LIGHT.'; END IF;
  SELECT * INTO v_tx FROM public.bank_transactions WHERE id = p_transaction_id;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT s.customer_id INTO v_cust FROM public.fibu_light_bank_suggestions(p_transaction_id, 1) s;
  IF v_cust IS NULL THEN RETURN; END IF;

  v_rest := round(coalesce(v_tx.amount,0), 2);
  FOR r IN
    SELECT i.id, coalesce(i.legal_invoice_number, i.invoice_number) AS num, i.customer_name, round(i.balance,2) AS bal
    FROM public.zoho_invoices i
    WHERE i.customer_id = v_cust AND coalesce(i.balance,0) > 0.009
      AND lower(coalesce(i.status,'')) NOT IN ('draft','entwurf','void','storniert','cancelled')
    ORDER BY i.due_date NULLS LAST, i.invoice_date
  LOOP
    EXIT WHEN v_rest <= 0.009;
    IF r.bal <= v_rest + 0.009 THEN
      invoice_id := r.id; invoice_number := r.num; customer_name := r.customer_name; open_amount := r.bal;
      v_rest := round(v_rest - r.bal, 2);
      RETURN NEXT;
    END IF;
  END LOOP;
END; $$;

-- ============ Verbindliche Zuordnung (idempotent) ============
CREATE OR REPLACE FUNCTION public.fibu_light_bank_confirm(
  p_transaction_id uuid, p_allocations jsonb, p_overpay text DEFAULT 'guthaben', p_source text DEFAULT 'vorschlag')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tx public.bank_transactions%ROWTYPE; v_existing numeric; v_sum numeric := 0;
  v_rest numeric; a jsonb; v_inv public.zoho_invoices%ROWTYPE; v_amt numeric; v_res jsonb;
  v_booked jsonb := '[]'::jsonb; v_first_customer text; v_first_name text;
BEGIN
  IF NOT public.can_use_fibu_light() THEN RAISE EXCEPTION 'Keine Berechtigung fuer FIBU LIGHT.'; END IF;
  IF p_allocations IS NULL OR jsonb_array_length(p_allocations) = 0 THEN
    RAISE EXCEPTION 'Keine Zuordnung uebergeben.';
  END IF;

  -- Sperre gegen Doppelklick und parallele Benutzer
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

    v_res := public.fibu_light_book_payment(
      v_inv.id, v_amt, coalesce(v_tx.value_date, v_tx.booking_date, current_date), 'Bank',
      coalesce(v_tx.end_to_end_reference, v_tx.bank_reference, left(coalesce(v_tx.purpose,''), 60)),
      'Bankzuordnung FIBU LIGHT · Transaktion ' || p_transaction_id::text, false);

    INSERT INTO public.bank_transaction_allocations
      (bank_transaction_id, invoice_id, invoice_number, allocation_type, allocated_amount, currency, note, created_by)
    VALUES (p_transaction_id, v_inv.id::text, coalesce(v_inv.legal_invoice_number, v_inv.invoice_number),
            'invoice', v_amt, coalesce(v_tx.currency,'EUR'), 'FIBU LIGHT', auth.uid());

    INSERT INTO public.op_light_bank_audit
      (transaction_id, action, invoice_id, invoice_number, customer_name, bank_amount, booked_amount,
       prev_balance, new_balance, matching_score, matching_reasons, source, result)
    VALUES (p_transaction_id, 'zugeordnet', v_inv.id, coalesce(v_inv.legal_invoice_number, v_inv.invoice_number),
            v_inv.customer_name, v_tx.amount, v_amt, v_inv.balance, (v_res->>'new_balance')::numeric,
            nullif(a->>'score','')::integer, a->'reasons', p_source, 'ZUGEORDNET');

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
     SET status = 'allocated', matched_invoice_id = (p_allocations->0->>'invoice_id'),
         matched_customer_id = NULL, matching_score = nullif(p_allocations->0->>'score','')::integer,
         updated_at = now()
   WHERE id = p_transaction_id;

  RETURN jsonb_build_object('transaction_id', p_transaction_id, 'allocated', v_sum,
                            'rest', v_rest, 'bookings', v_booked);
END; $$;

-- ============ Unklare Zahlung / Klaerungsfall ============
CREATE OR REPLACE FUNCTION public.fibu_light_bank_set_case(p_transaction_id uuid, p_reason text, p_note text DEFAULT NULL, p_action text DEFAULT 'unklar')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.can_use_fibu_light() THEN RAISE EXCEPTION 'Keine Berechtigung fuer FIBU LIGHT.'; END IF;
  IF btrim(coalesce(p_reason,'')) = '' THEN RAISE EXCEPTION 'Bitte einen Grund angeben.'; END IF;
  INSERT INTO public.op_light_bank_cases (transaction_id, action, reason, note)
  VALUES (p_transaction_id, coalesce(p_action,'unklar'), p_reason, p_note) RETURNING id INTO v_id;
  INSERT INTO public.op_light_bank_audit (transaction_id, action, source, result, note)
  VALUES (p_transaction_id, coalesce(p_action,'unklar'), 'manuell', 'KLAERUNG', concat_ws(' | ', p_reason, p_note));
  RETURN v_id;
END; $$;

-- ============ Dashboard-Kennzahlen ============
CREATE OR REPLACE FUNCTION public.fibu_light_bank_dashboard()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v jsonb;
BEGIN
  IF NOT public.can_use_fibu_light() THEN RAISE EXCEPTION 'Keine Berechtigung fuer FIBU LIGHT.'; END IF;
  SELECT jsonb_build_object(
    'ungeprueft', count(*) FILTER (WHERE NOT l.is_allocated),
    'vorschlaege', count(*) FILTER (WHERE NOT l.is_allocated AND l.best_score >= 70),
    'unklar', count(*) FILTER (WHERE NOT l.is_allocated AND (l.best_score < 40 OR l.case_open)),
    'summe_offen', coalesce(sum(l.amount) FILTER (WHERE NOT l.is_allocated), 0),
    'heute_zugeordnet', (SELECT count(*) FROM public.op_light_bank_audit a
                          WHERE a.action = 'zugeordnet' AND a.created_at::date = current_date)
  ) INTO v FROM public.fibu_light_bank_list('alle', NULL, 500) l;
  RETURN v;
END; $$;

REVOKE EXECUTE ON FUNCTION public.fibu_light_bank_suggestions(uuid, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.fibu_light_bank_list(text, text, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.fibu_light_bank_group_suggestion(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.fibu_light_bank_confirm(uuid, jsonb, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.fibu_light_bank_set_case(uuid, text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.fibu_light_bank_dashboard() FROM anon;
