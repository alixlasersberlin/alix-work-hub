-- FIBU LIGHT Phase 2 (additiv, keine Aenderung bestehender Daten)

-- ---------- Mahnregeln (zentral, nur Admin aendert) ----------
CREATE TABLE IF NOT EXISTS public.op_light_dunning_rules (
  level smallint PRIMARY KEY CHECK (level BETWEEN 1 AND 4),
  label text NOT NULL,
  offset_days integer NOT NULL,
  active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT SELECT ON public.op_light_dunning_rules TO authenticated;
GRANT ALL ON public.op_light_dunning_rules TO service_role;
ALTER TABLE public.op_light_dunning_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read dunning rules" ON public.op_light_dunning_rules;
CREATE POLICY "read dunning rules" ON public.op_light_dunning_rules
  FOR SELECT TO authenticated USING (public.can_use_fibu_light());
DROP POLICY IF EXISTS "admin writes dunning rules" ON public.op_light_dunning_rules;
CREATE POLICY "admin writes dunning rules" ON public.op_light_dunning_rules
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

INSERT INTO public.op_light_dunning_rules (level, label, offset_days)
VALUES (1,'Zahlungserinnerung',3), (2,'1. Mahnung',7), (3,'2. Mahnung',14), (4,'Letzte Mahnung',21)
ON CONFLICT (level) DO NOTHING;

-- ---------- Klaerungsfaelle / Mahnsperre (append-only Ereignisse) ----------
CREATE TABLE IF NOT EXISTS public.op_light_case_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL,
  invoice_number text,
  action text NOT NULL CHECK (action IN ('set','clear')),
  reason text,
  note text,
  pause_until date,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.op_light_case_events TO authenticated;
GRANT ALL ON public.op_light_case_events TO service_role;
ALTER TABLE public.op_light_case_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fibu light reads cases" ON public.op_light_case_events;
CREATE POLICY "fibu light reads cases" ON public.op_light_case_events
  FOR SELECT TO authenticated USING (public.can_use_fibu_light());
DROP TRIGGER IF EXISTS trg_op_light_cases_immutable ON public.op_light_case_events;
CREATE TRIGGER trg_op_light_cases_immutable BEFORE UPDATE OR DELETE ON public.op_light_case_events
  FOR EACH ROW EXECUTE FUNCTION public.op_light_immutable();
CREATE INDEX IF NOT EXISTS idx_op_light_cases_invoice ON public.op_light_case_events(invoice_id, created_at DESC);

-- ---------- Ratenvereinbarungen ----------
CREATE TABLE IF NOT EXISTS public.op_light_installment_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL,
  invoice_number text,
  customer_name text,
  total_amount numeric NOT NULL,
  installment_count smallint NOT NULL CHECK (installment_count BETWEEN 1 AND 60),
  agreement_date date NOT NULL DEFAULT current_date,
  note text,
  status text NOT NULL DEFAULT 'active',
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.op_light_installments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.op_light_installment_plans(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL,
  seq smallint NOT NULL,
  amount numeric NOT NULL,
  due_date date NOT NULL,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.op_light_installment_plans TO authenticated;
GRANT SELECT ON public.op_light_installments TO authenticated;
GRANT ALL ON public.op_light_installment_plans TO service_role;
GRANT ALL ON public.op_light_installments TO service_role;
ALTER TABLE public.op_light_installment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.op_light_installments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fibu light reads plans" ON public.op_light_installment_plans;
CREATE POLICY "fibu light reads plans" ON public.op_light_installment_plans
  FOR SELECT TO authenticated USING (public.can_use_fibu_light());
DROP POLICY IF EXISTS "fibu light reads installments" ON public.op_light_installments;
CREATE POLICY "fibu light reads installments" ON public.op_light_installments
  FOR SELECT TO authenticated USING (public.can_use_fibu_light());
CREATE INDEX IF NOT EXISTS idx_op_light_plans_invoice ON public.op_light_installment_plans(invoice_id);
CREATE INDEX IF NOT EXISTS idx_op_light_installments_plan ON public.op_light_installments(plan_id);

-- ---------- Buchungsfehler melden ----------
CREATE TABLE IF NOT EXISTS public.op_light_booking_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL,
  invoice_number text,
  transaction_id uuid,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  reported_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_by uuid,
  resolved_at timestamptz,
  resolution_note text
);
GRANT SELECT ON public.op_light_booking_issues TO authenticated;
GRANT ALL ON public.op_light_booking_issues TO service_role;
ALTER TABLE public.op_light_booking_issues ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fibu light reads issues" ON public.op_light_booking_issues;
CREATE POLICY "fibu light reads issues" ON public.op_light_booking_issues
  FOR SELECT TO authenticated USING (public.can_use_fibu_light());
CREATE INDEX IF NOT EXISTS idx_op_light_issues_invoice ON public.op_light_booking_issues(invoice_id);

-- ---------- Offene Posten inkl. Klaerung, Raten, naechste Aktion ----------
DROP FUNCTION IF EXISTS public.fibu_light_open_items();
CREATE FUNCTION public.fibu_light_open_items()
RETURNS TABLE (
  id uuid, invoice_number text, legal_invoice_number text, customer_id text, customer_name text,
  invoice_date date, due_date date, total numeric, balance numeric, paid numeric, currency text,
  status text, payment_status text, zoho_invoice_id text, source_system text,
  days_overdue integer, dunning_level smallint, last_action_at timestamptz, last_action text,
  case_active boolean, case_reason text, case_note text, case_pause_until date,
  plan_id uuid, plan_installments smallint, next_rate_amount numeric, next_rate_due date,
  next_action_level smallint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH rules AS (SELECT level, offset_days FROM public.op_light_dunning_rules WHERE active)
  SELECT i.id, i.invoice_number, i.legal_invoice_number, i.customer_id, i.customer_name,
         i.invoice_date, i.due_date, i.total, i.balance,
         greatest(coalesce(i.total,0) - coalesce(i.balance,0), 0) AS paid,
         i.currency, i.status, i.payment_status, i.zoho_invoice_id, i.source_system,
         CASE WHEN i.due_date IS NULL THEN 0 ELSE (current_date - i.due_date) END AS days_overdue,
         coalesce(d.max_level, 0)::smallint AS dunning_level,
         d.last_sent AS last_action_at,
         CASE coalesce(d.max_level, 0)
           WHEN 1 THEN 'Zahlungserinnerung' WHEN 2 THEN '1. Mahnung'
           WHEN 3 THEN '2. Mahnung' WHEN 4 THEN 'Letzte Mahnung' ELSE NULL END AS last_action,
         (c.action = 'set' AND (c.pause_until IS NULL OR c.pause_until >= current_date)) AS case_active,
         CASE WHEN c.action = 'set' THEN c.reason END AS case_reason,
         CASE WHEN c.action = 'set' THEN c.note END AS case_note,
         CASE WHEN c.action = 'set' THEN c.pause_until END AS case_pause_until,
         p.id AS plan_id, p.installment_count AS plan_installments,
         r.amount AS next_rate_amount, r.due_date AS next_rate_due,
         CASE
           WHEN i.due_date IS NULL OR (current_date - i.due_date) <= 0 THEN 0::smallint
           ELSE least(4, greatest(
                  coalesce(d.max_level, 0) + 1,
                  coalesce((SELECT max(rl.level) FROM rules rl
                            WHERE (current_date - i.due_date) >= rl.offset_days), 0) ))::smallint
         END AS next_action_level
  FROM public.zoho_invoices i
  LEFT JOIN LATERAL (
    SELECT max(l.level) AS max_level, max(l.sent_at) AS last_sent
    FROM public.op_light_dunning_log l
    WHERE l.invoice_id = i.id AND l.send_status = 'sent'
  ) d ON true
  LEFT JOIN LATERAL (
    SELECT ce.action, ce.reason, ce.note, ce.pause_until
    FROM public.op_light_case_events ce
    WHERE ce.invoice_id = i.id ORDER BY ce.created_at DESC LIMIT 1
  ) c ON true
  LEFT JOIN LATERAL (
    SELECT pl.id, pl.installment_count FROM public.op_light_installment_plans pl
    WHERE pl.invoice_id = i.id AND pl.status = 'active'
    ORDER BY pl.created_at DESC LIMIT 1
  ) p ON true
  LEFT JOIN LATERAL (
    SELECT it.amount, it.due_date FROM public.op_light_installments it
    WHERE it.plan_id = p.id AND it.paid_at IS NULL
    ORDER BY it.due_date LIMIT 1
  ) r ON true
  WHERE public.can_use_fibu_light()
    AND coalesce(i.balance, 0) > 0.009
    AND lower(coalesce(i.status, '')) NOT IN ('draft','entwurf','void','storniert','cancelled')
  ORDER BY i.due_date NULLS LAST, i.invoice_number;
$$;
REVOKE EXECUTE ON FUNCTION public.fibu_light_open_items() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.fibu_light_open_items() TO authenticated;

-- ---------- Klaerungsfall setzen / aufheben ----------
CREATE OR REPLACE FUNCTION public.fibu_light_set_clarification(
  p_invoice_id uuid, p_reason text, p_note text DEFAULT NULL, p_pause_until date DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_num text; v_id uuid;
BEGIN
  IF NOT public.can_use_fibu_light() THEN RAISE EXCEPTION 'Keine Berechtigung fuer FIBU LIGHT.'; END IF;
  IF btrim(coalesce(p_reason,'')) = '' THEN RAISE EXCEPTION 'Bitte einen Grund angeben.'; END IF;
  SELECT coalesce(legal_invoice_number, invoice_number) INTO v_num FROM public.zoho_invoices WHERE id = p_invoice_id;
  IF v_num IS NULL THEN RAISE EXCEPTION 'Rechnung nicht gefunden.'; END IF;
  INSERT INTO public.op_light_case_events (invoice_id, invoice_number, action, reason, note, pause_until)
  VALUES (p_invoice_id, v_num, 'set', p_reason, p_note, p_pause_until) RETURNING id INTO v_id;
  PERFORM public.log_audit_event('FIBU_LIGHT_CASE_SET','fibu-light', p_invoice_id::text,
    jsonb_build_object('reason', p_reason, 'pause_until', p_pause_until, 'invoice_number', v_num), NULL, NULL);
  RETURN v_id;
END; $$;
REVOKE EXECUTE ON FUNCTION public.fibu_light_set_clarification(uuid, text, text, date) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.fibu_light_set_clarification(uuid, text, text, date) TO authenticated;

CREATE OR REPLACE FUNCTION public.fibu_light_clear_clarification(p_invoice_id uuid, p_note text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_num text; v_id uuid;
BEGIN
  IF NOT public.can_use_fibu_light() THEN RAISE EXCEPTION 'Keine Berechtigung fuer FIBU LIGHT.'; END IF;
  SELECT coalesce(legal_invoice_number, invoice_number) INTO v_num FROM public.zoho_invoices WHERE id = p_invoice_id;
  INSERT INTO public.op_light_case_events (invoice_id, invoice_number, action, note)
  VALUES (p_invoice_id, v_num, 'clear', p_note) RETURNING id INTO v_id;
  PERFORM public.log_audit_event('FIBU_LIGHT_CASE_CLEAR','fibu-light', p_invoice_id::text,
    jsonb_build_object('invoice_number', v_num), NULL, NULL);
  RETURN v_id;
END; $$;
REVOKE EXECUTE ON FUNCTION public.fibu_light_clear_clarification(uuid, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.fibu_light_clear_clarification(uuid, text) TO authenticated;

-- ---------- Ratenvereinbarung ----------
CREATE OR REPLACE FUNCTION public.fibu_light_create_installment_plan(
  p_invoice_id uuid, p_count smallint, p_amount numeric, p_first_due date,
  p_interval_months smallint DEFAULT 1, p_note text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_inv public.zoho_invoices%ROWTYPE; v_plan uuid; v_rate numeric; v_last numeric; v_i int;
BEGIN
  IF NOT public.can_use_fibu_light() THEN RAISE EXCEPTION 'Keine Berechtigung fuer FIBU LIGHT.'; END IF;
  SELECT * INTO v_inv FROM public.zoho_invoices WHERE id = p_invoice_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Rechnung nicht gefunden.'; END IF;
  IF coalesce(p_count,0) < 1 THEN RAISE EXCEPTION 'Anzahl der Raten muss mindestens 1 sein.'; END IF;

  UPDATE public.op_light_installment_plans SET status = 'replaced'
   WHERE invoice_id = p_invoice_id AND status = 'active';

  v_rate := round(coalesce(nullif(p_amount,0), coalesce(v_inv.balance,0) / p_count), 2);
  v_last := round(coalesce(v_inv.balance,0) - v_rate * (p_count - 1), 2);

  INSERT INTO public.op_light_installment_plans (invoice_id, invoice_number, customer_name, total_amount,
                                                 installment_count, agreement_date, note)
  VALUES (p_invoice_id, coalesce(v_inv.legal_invoice_number, v_inv.invoice_number), v_inv.customer_name,
          coalesce(v_inv.balance,0), p_count, current_date, p_note)
  RETURNING id INTO v_plan;

  FOR v_i IN 1..p_count LOOP
    INSERT INTO public.op_light_installments (plan_id, invoice_id, seq, amount, due_date)
    VALUES (v_plan, p_invoice_id, v_i,
            CASE WHEN v_i = p_count THEN greatest(v_last, 0) ELSE v_rate END,
            coalesce(p_first_due, current_date) + ((v_i - 1) * coalesce(p_interval_months,1) || ' months')::interval);
  END LOOP;

  PERFORM public.log_audit_event('FIBU_LIGHT_INSTALLMENT_PLAN','fibu-light', p_invoice_id::text,
    jsonb_build_object('plan_id', v_plan, 'count', p_count, 'rate', v_rate,
                       'invoice_number', coalesce(v_inv.legal_invoice_number, v_inv.invoice_number)), NULL, NULL);
  RETURN jsonb_build_object('plan_id', v_plan, 'rate', v_rate, 'count', p_count);
END; $$;
REVOKE EXECUTE ON FUNCTION public.fibu_light_create_installment_plan(uuid, smallint, numeric, date, smallint, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.fibu_light_create_installment_plan(uuid, smallint, numeric, date, smallint, text) TO authenticated;

-- ---------- Buchungsfehler melden / bearbeiten ----------
CREATE OR REPLACE FUNCTION public.fibu_light_report_booking_issue(
  p_invoice_id uuid, p_description text, p_transaction_id uuid DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_num text; v_id uuid;
BEGIN
  IF NOT public.can_use_fibu_light() THEN RAISE EXCEPTION 'Keine Berechtigung fuer FIBU LIGHT.'; END IF;
  IF btrim(coalesce(p_description,'')) = '' THEN RAISE EXCEPTION 'Bitte den Fehler beschreiben.'; END IF;
  SELECT coalesce(legal_invoice_number, invoice_number) INTO v_num FROM public.zoho_invoices WHERE id = p_invoice_id;
  INSERT INTO public.op_light_booking_issues (invoice_id, invoice_number, transaction_id, description)
  VALUES (p_invoice_id, v_num, p_transaction_id, p_description) RETURNING id INTO v_id;
  PERFORM public.log_audit_event('FIBU_LIGHT_BOOKING_ISSUE','fibu-light', p_invoice_id::text,
    jsonb_build_object('issue_id', v_id, 'invoice_number', v_num, 'transaction_id', p_transaction_id), NULL, NULL);
  RETURN v_id;
END; $$;
REVOKE EXECUTE ON FUNCTION public.fibu_light_report_booking_issue(uuid, text, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.fibu_light_report_booking_issue(uuid, text, uuid) TO authenticated;

-- ---------- Bank-Matching Vorschlaege (nur lesend, Vorbereitung Phase 3) ----------
CREATE OR REPLACE FUNCTION public.fibu_light_bank_match_suggestions(p_limit integer DEFAULT 25)
RETURNS TABLE (
  transaction_id uuid, booking_date date, amount numeric, sender_name text, purpose text,
  invoice_id uuid, invoice_number text, customer_name text, open_amount numeric, score integer
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT b.id, b.booking_date, b.amount, b.sender_receiver_name, b.purpose,
         i.id, coalesce(i.legal_invoice_number, i.invoice_number), i.customer_name, i.balance,
         (CASE WHEN b.purpose ILIKE '%' || coalesce(i.legal_invoice_number, i.invoice_number) || '%' THEN 60 ELSE 0 END
        + CASE WHEN abs(coalesce(b.amount,0) - coalesce(i.balance,0)) < 0.01 THEN 30 ELSE 0 END
        + CASE WHEN lower(coalesce(b.sender_receiver_name,'')) = lower(coalesce(i.customer_name,'')) THEN 10 ELSE 0 END)::integer
  FROM public.bank_transactions b
  JOIN public.zoho_invoices i
    ON coalesce(i.balance,0) > 0.009
   AND ( b.purpose ILIKE '%' || coalesce(i.legal_invoice_number, i.invoice_number) || '%'
      OR abs(coalesce(b.amount,0) - coalesce(i.balance,0)) < 0.01 )
  WHERE public.can_use_fibu_light()
    AND coalesce(b.amount,0) > 0
    AND coalesce(b.status,'') NOT IN ('booked','allocated','matched')
    AND b.matched_invoice_id IS NULL
    AND coalesce(b.is_duplicate,false) = false
  ORDER BY 10 DESC, b.booking_date DESC
  LIMIT greatest(coalesce(p_limit,25), 1);
$$;
REVOKE EXECUTE ON FUNCTION public.fibu_light_bank_match_suggestions(integer) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.fibu_light_bank_match_suggestions(integer) TO authenticated;

-- ---------- Historie erweitern ----------
CREATE OR REPLACE FUNCTION public.fibu_light_invoice_history(p_invoice_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_inv public.zoho_invoices%ROWTYPE; v_ref text;
BEGIN
  IF NOT public.can_use_fibu_light() THEN RAISE EXCEPTION 'Keine Berechtigung fuer FIBU LIGHT.'; END IF;
  SELECT * INTO v_inv FROM public.zoho_invoices WHERE id = p_invoice_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('payments','[]'::jsonb,'dunning','[]'::jsonb,'notes','[]'::jsonb,
                                              'cases','[]'::jsonb,'installments','[]'::jsonb,'issues','[]'::jsonb); END IF;
  v_ref := coalesce(v_inv.legal_invoice_number, v_inv.invoice_number);

  RETURN jsonb_build_object(
    'payments', coalesce((SELECT jsonb_agg(jsonb_build_object('id', t.id, 'amount', t.amount, 'booking_date', t.booking_date,
                                                              'reference', t.reference, 'notes', t.notes) ORDER BY t.booking_date DESC)
                          FROM public.finance_transactions t
                          WHERE t.transaction_type = 'Zahlung'
                            AND (t.reference = v_ref OR t.notes ILIKE '%Rechnung: ' || v_ref || '%')), '[]'::jsonb),
    'dunning', coalesce((SELECT jsonb_agg(to_jsonb(l) ORDER BY l.sent_at DESC) FROM public.op_light_dunning_log l WHERE l.invoice_id = p_invoice_id), '[]'::jsonb),
    'notes', coalesce((SELECT jsonb_agg(to_jsonb(n) ORDER BY n.created_at DESC) FROM public.op_light_notes n WHERE n.invoice_id = p_invoice_id), '[]'::jsonb),
    'cases', coalesce((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.created_at DESC) FROM public.op_light_case_events c WHERE c.invoice_id = p_invoice_id), '[]'::jsonb),
    'installments', coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.seq) FROM public.op_light_installments x WHERE x.invoice_id = p_invoice_id), '[]'::jsonb),
    'issues', coalesce((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.created_at DESC) FROM public.op_light_booking_issues s WHERE s.invoice_id = p_invoice_id), '[]'::jsonb)
  );
END; $$;
REVOKE EXECUTE ON FUNCTION public.fibu_light_invoice_history(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.fibu_light_invoice_history(uuid) TO authenticated;