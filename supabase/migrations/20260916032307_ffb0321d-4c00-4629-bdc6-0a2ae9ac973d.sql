-- FIBU LIGHT / Offene Posten Light (additiv, keine Änderung bestehender Daten)

INSERT INTO public.roles (name, description)
SELECT 'FIBU LIGHT', 'Vereinfachte Offene-Posten-Bearbeitung: Zahlungen erfassen, Erinnerungen/Mahnungen senden. Kein Zugriff auf das Finance-Modul.'
WHERE NOT EXISTS (SELECT 1 FROM public.roles WHERE name = 'FIBU LIGHT');

CREATE OR REPLACE FUNCTION public.is_fibu_light()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role('FIBU LIGHT');
$$;

CREATE OR REPLACE FUNCTION public.can_use_fibu_light()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_admin()
      OR public.has_role('FIBU LIGHT')
      OR public.has_role('Buchhaltung Admin')
      OR public.has_role('Buchhaltung EU')
      OR public.has_role('Buchhaltung CH');
$$;

-- ---------- Protokolltabellen (append-only) ----------
CREATE TABLE IF NOT EXISTS public.op_light_dunning_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL,
  invoice_number text,
  customer_name text,
  recipient_email text NOT NULL,
  level smallint NOT NULL CHECK (level BETWEEN 1 AND 4),
  subject text,
  message text,
  template text,
  open_amount numeric,
  due_date date,
  send_status text NOT NULL DEFAULT 'sent',
  error_message text,
  sent_at timestamptz NOT NULL DEFAULT now(),
  sent_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.op_light_dunning_log TO authenticated;
GRANT ALL ON public.op_light_dunning_log TO service_role;
ALTER TABLE public.op_light_dunning_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fibu light read dunning" ON public.op_light_dunning_log;
CREATE POLICY "fibu light read dunning" ON public.op_light_dunning_log
  FOR SELECT TO authenticated USING (public.can_use_fibu_light());

CREATE TABLE IF NOT EXISTS public.op_light_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL,
  invoice_number text,
  note text NOT NULL,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.op_light_notes TO authenticated;
GRANT ALL ON public.op_light_notes TO service_role;
ALTER TABLE public.op_light_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fibu light read notes" ON public.op_light_notes;
CREATE POLICY "fibu light read notes" ON public.op_light_notes
  FOR SELECT TO authenticated USING (public.can_use_fibu_light());

CREATE OR REPLACE FUNCTION public.op_light_immutable()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'Protokolleintraege in % sind unveraenderbar (GoBD).', TG_TABLE_NAME;
END;
$$;
DROP TRIGGER IF EXISTS trg_op_light_dunning_immutable ON public.op_light_dunning_log;
CREATE TRIGGER trg_op_light_dunning_immutable BEFORE UPDATE OR DELETE ON public.op_light_dunning_log
  FOR EACH ROW EXECUTE FUNCTION public.op_light_immutable();
DROP TRIGGER IF EXISTS trg_op_light_notes_immutable ON public.op_light_notes;
CREATE TRIGGER trg_op_light_notes_immutable BEFORE UPDATE OR DELETE ON public.op_light_notes
  FOR EACH ROW EXECUTE FUNCTION public.op_light_immutable();

CREATE INDEX IF NOT EXISTS idx_op_light_dunning_invoice ON public.op_light_dunning_log(invoice_id);
CREATE INDEX IF NOT EXISTS idx_op_light_notes_invoice ON public.op_light_notes(invoice_id);

-- ---------- Lesezugriff für FIBU LIGHT (nur offene Ausgangsrechnungen) ----------
DROP POLICY IF EXISTS "fibu light reads open invoices" ON public.zoho_invoices;
CREATE POLICY "fibu light reads open invoices" ON public.zoho_invoices
  FOR SELECT TO authenticated
  USING (public.is_fibu_light() AND coalesce(balance, 0) > 0);

DROP POLICY IF EXISTS "fibu light reads customers" ON public.customers;
CREATE POLICY "fibu light reads customers" ON public.customers
  FOR SELECT TO authenticated USING (public.is_fibu_light());

DROP POLICY IF EXISTS "fibu light reads payments" ON public.finance_transactions;
CREATE POLICY "fibu light reads payments" ON public.finance_transactions
  FOR SELECT TO authenticated
  USING (public.is_fibu_light() AND transaction_type = 'Zahlung');

-- ---------- Offene Posten (eine Quelle: zoho_invoices) ----------
CREATE OR REPLACE FUNCTION public.fibu_light_open_items()
RETURNS TABLE (
  id uuid, invoice_number text, legal_invoice_number text, customer_id text, customer_name text,
  invoice_date date, due_date date, total numeric, balance numeric, paid numeric, currency text,
  status text, payment_status text, zoho_invoice_id text, source_system text,
  days_overdue integer, dunning_level smallint, last_action_at timestamptz, last_action text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT i.id, i.invoice_number, i.legal_invoice_number, i.customer_id, i.customer_name,
         i.invoice_date, i.due_date, i.total, i.balance,
         greatest(coalesce(i.total,0) - coalesce(i.balance,0), 0) AS paid,
         i.currency, i.status, i.payment_status, i.zoho_invoice_id, i.source_system,
         CASE WHEN i.due_date IS NULL THEN 0 ELSE (current_date - i.due_date) END AS days_overdue,
         coalesce(d.max_level, 0)::smallint AS dunning_level,
         d.last_sent AS last_action_at,
         CASE coalesce(d.max_level, 0)
           WHEN 1 THEN 'Zahlungserinnerung' WHEN 2 THEN '1. Mahnung'
           WHEN 3 THEN '2. Mahnung' WHEN 4 THEN 'Letzte Mahnung' ELSE NULL END AS last_action
  FROM public.zoho_invoices i
  LEFT JOIN LATERAL (
    SELECT max(l.level) AS max_level, max(l.sent_at) AS last_sent
    FROM public.op_light_dunning_log l
    WHERE l.invoice_id = i.id AND l.send_status = 'sent'
  ) d ON true
  WHERE public.can_use_fibu_light()
    AND coalesce(i.balance, 0) > 0.009
    AND lower(coalesce(i.status, '')) NOT IN ('draft','entwurf','void','storniert','cancelled')
  ORDER BY i.due_date NULLS LAST, i.invoice_number;
$$;
GRANT EXECUTE ON FUNCTION public.fibu_light_open_items() TO authenticated;

-- ---------- Zahlung buchen (serverseitig, protokolliert) ----------
CREATE OR REPLACE FUNCTION public.fibu_light_book_payment(
  p_invoice_id uuid,
  p_amount numeric,
  p_payment_date date,
  p_method text DEFAULT 'Bank',
  p_reference text DEFAULT NULL,
  p_note text DEFAULT NULL,
  p_full boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_inv public.zoho_invoices%ROWTYPE;
  v_amount numeric;
  v_new_balance numeric;
  v_tx uuid;
BEGIN
  IF NOT public.can_use_fibu_light() THEN
    RAISE EXCEPTION 'Keine Berechtigung fuer FIBU LIGHT.';
  END IF;

  SELECT * INTO v_inv FROM public.zoho_invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Rechnung nicht gefunden.'; END IF;
  IF coalesce(v_inv.balance, 0) <= 0 THEN RAISE EXCEPTION 'Rechnung ist bereits ausgeglichen.'; END IF;

  v_amount := CASE WHEN p_full THEN coalesce(v_inv.balance, 0) ELSE round(coalesce(p_amount, 0), 2) END;
  IF v_amount <= 0 THEN RAISE EXCEPTION 'Zahlbetrag muss groesser als 0 sein.'; END IF;
  IF v_amount > coalesce(v_inv.balance, 0) + 0.009 THEN
    RAISE EXCEPTION 'Zahlbetrag (%) uebersteigt den offenen Betrag (%).', v_amount, v_inv.balance;
  END IF;

  INSERT INTO public.finance_transactions (amount, currency, booking_date, reference, transaction_type, notes,
                                           tenant_id, accounting_region)
  VALUES (v_amount, coalesce(v_inv.currency, 'EUR'), coalesce(p_payment_date, current_date),
          coalesce(nullif(btrim(coalesce(p_reference, '')), ''),
                   coalesce(v_inv.legal_invoice_number, v_inv.invoice_number)),
          'Zahlung',
          concat_ws(' | ', 'FIBU LIGHT', 'Zahlungsart: ' || coalesce(p_method, 'Bank'),
                    'Rechnung: ' || coalesce(v_inv.legal_invoice_number, v_inv.invoice_number),
                    nullif(btrim(coalesce(p_note, '')), '')),
          v_inv.tenant_id, v_inv.accounting_region)
  RETURNING id INTO v_tx;

  v_new_balance := round(greatest(coalesce(v_inv.balance, 0) - v_amount, 0), 2);

  UPDATE public.zoho_invoices
     SET balance = v_new_balance,
         payment_status = CASE WHEN v_new_balance <= 0.009 THEN 'paid' ELSE 'partially_paid' END,
         last_payment_date = coalesce(p_payment_date, current_date),
         status = CASE WHEN v_new_balance <= 0.009 THEN 'paid' ELSE status END,
         updated_at = now()
   WHERE id = p_invoice_id;

  PERFORM public.log_audit_event(
    'FIBU_LIGHT_PAYMENT', 'fibu-light', p_invoice_id::text,
    jsonb_build_object('invoice_number', coalesce(v_inv.legal_invoice_number, v_inv.invoice_number),
                       'amount', v_amount, 'method', p_method, 'reference', p_reference,
                       'payment_date', coalesce(p_payment_date, current_date),
                       'old_balance', v_inv.balance, 'new_balance', v_new_balance,
                       'transaction_id', v_tx),
    NULL, NULL);

  RETURN jsonb_build_object('transaction_id', v_tx, 'amount', v_amount,
                            'new_balance', v_new_balance, 'closed', v_new_balance <= 0.009);
END;
$$;
GRANT EXECUTE ON FUNCTION public.fibu_light_book_payment(uuid, numeric, date, text, text, text, boolean) TO authenticated;

-- ---------- Mahnprotokoll ----------
CREATE OR REPLACE FUNCTION public.fibu_light_log_dunning(
  p_invoice_id uuid, p_level smallint, p_recipient text, p_subject text, p_message text,
  p_open_amount numeric DEFAULT NULL, p_send_status text DEFAULT 'sent', p_error text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_inv public.zoho_invoices%ROWTYPE; v_id uuid;
BEGIN
  IF NOT public.can_use_fibu_light() THEN RAISE EXCEPTION 'Keine Berechtigung fuer FIBU LIGHT.'; END IF;
  SELECT * INTO v_inv FROM public.zoho_invoices WHERE id = p_invoice_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Rechnung nicht gefunden.'; END IF;

  INSERT INTO public.op_light_dunning_log (invoice_id, invoice_number, customer_name, recipient_email, level,
                                           subject, message, template, open_amount, due_date, send_status, error_message)
  VALUES (p_invoice_id, coalesce(v_inv.legal_invoice_number, v_inv.invoice_number), v_inv.customer_name,
          p_recipient, p_level, p_subject, p_message, 'finance-reminder',
          coalesce(p_open_amount, v_inv.balance), v_inv.due_date, coalesce(p_send_status, 'sent'), p_error)
  RETURNING id INTO v_id;

  PERFORM public.log_audit_event(
    'FIBU_LIGHT_DUNNING', 'fibu-light', p_invoice_id::text,
    jsonb_build_object('level', p_level, 'recipient', p_recipient, 'status', p_send_status,
                       'invoice_number', coalesce(v_inv.legal_invoice_number, v_inv.invoice_number)),
    NULL, NULL);
  RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.fibu_light_log_dunning(uuid, smallint, text, text, text, numeric, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.fibu_light_add_note(p_invoice_id uuid, p_note text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_num text;
BEGIN
  IF NOT public.can_use_fibu_light() THEN RAISE EXCEPTION 'Keine Berechtigung fuer FIBU LIGHT.'; END IF;
  IF btrim(coalesce(p_note, '')) = '' THEN RAISE EXCEPTION 'Notiz darf nicht leer sein.'; END IF;
  SELECT coalesce(legal_invoice_number, invoice_number) INTO v_num FROM public.zoho_invoices WHERE id = p_invoice_id;
  INSERT INTO public.op_light_notes (invoice_id, invoice_number, note)
  VALUES (p_invoice_id, v_num, p_note) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.fibu_light_add_note(uuid, text) TO authenticated;

-- ---------- Zahlungshistorie je Rechnung ----------
CREATE OR REPLACE FUNCTION public.fibu_light_invoice_history(p_invoice_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_inv public.zoho_invoices%ROWTYPE; v_ref text;
BEGIN
  IF NOT public.can_use_fibu_light() THEN RAISE EXCEPTION 'Keine Berechtigung fuer FIBU LIGHT.'; END IF;
  SELECT * INTO v_inv FROM public.zoho_invoices WHERE id = p_invoice_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('payments', '[]'::jsonb, 'dunning', '[]'::jsonb, 'notes', '[]'::jsonb); END IF;
  v_ref := coalesce(v_inv.legal_invoice_number, v_inv.invoice_number);

  RETURN jsonb_build_object(
    'payments', coalesce((SELECT jsonb_agg(jsonb_build_object('id', t.id, 'amount', t.amount, 'booking_date', t.booking_date,
                                                              'reference', t.reference, 'notes', t.notes) ORDER BY t.booking_date DESC)
                          FROM public.finance_transactions t
                          WHERE t.transaction_type = 'Zahlung'
                            AND (t.reference = v_ref OR t.notes ILIKE '%Rechnung: ' || v_ref || '%')), '[]'::jsonb),
    'dunning', coalesce((SELECT jsonb_agg(to_jsonb(l) ORDER BY l.sent_at DESC) FROM public.op_light_dunning_log l WHERE l.invoice_id = p_invoice_id), '[]'::jsonb),
    'notes', coalesce((SELECT jsonb_agg(to_jsonb(n) ORDER BY n.created_at DESC) FROM public.op_light_notes n WHERE n.invoice_id = p_invoice_id), '[]'::jsonb)
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.fibu_light_invoice_history(uuid) TO authenticated;