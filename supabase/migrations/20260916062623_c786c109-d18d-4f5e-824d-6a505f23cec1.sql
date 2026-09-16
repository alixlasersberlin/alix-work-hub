-- Eskalationen (Anwalt / internes Inkasso) -- additiv
CREATE TABLE IF NOT EXISTS public.op_light_escalations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL,
  invoice_number text,
  customer_id text,
  customer_name text,
  stage text NOT NULL CHECK (stage IN ('anwalt','inkasso_intern')),
  action text NOT NULL DEFAULT 'set' CHECK (action IN ('set','clear')),
  note text,
  open_amount numeric,
  currency text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_op_light_escalations_invoice ON public.op_light_escalations (invoice_id, created_at DESC);

GRANT SELECT, INSERT ON public.op_light_escalations TO authenticated;
GRANT ALL ON public.op_light_escalations TO service_role;

ALTER TABLE public.op_light_escalations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "esk_select" ON public.op_light_escalations;
CREATE POLICY "esk_select" ON public.op_light_escalations
  FOR SELECT TO authenticated USING (public.can_use_fibu_light());

DROP POLICY IF EXISTS "esk_insert" ON public.op_light_escalations;
CREATE POLICY "esk_insert" ON public.op_light_escalations
  FOR INSERT TO authenticated WITH CHECK (public.can_use_fibu_light());

-- Unveraenderbarkeit
CREATE OR REPLACE FUNCTION public.op_light_escalations_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  RAISE EXCEPTION 'Eskalationsprotokoll ist unveraenderbar.';
END; $$;

DROP TRIGGER IF EXISTS trg_op_light_escalations_guard ON public.op_light_escalations;
CREATE TRIGGER trg_op_light_escalations_guard
  BEFORE UPDATE OR DELETE ON public.op_light_escalations
  FOR EACH ROW EXECUTE FUNCTION public.op_light_escalations_guard();

-- Einzel-/Massenuebergabe
CREATE OR REPLACE FUNCTION public.fibu_light_set_escalation(
  p_invoice_ids uuid[], p_stage text, p_note text DEFAULT NULL)
RETURNS TABLE(invoice_id uuid, invoice_number text, ok boolean, message text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_id uuid; v_num text; v_cust text; v_cname text; v_bal numeric; v_cur text; v_cnt int := 0;
BEGIN
  IF NOT public.can_use_fibu_light() THEN RAISE EXCEPTION 'Keine Berechtigung fuer FIBU LIGHT.'; END IF;
  IF p_stage NOT IN ('anwalt','inkasso_intern') THEN RAISE EXCEPTION 'Unbekannte Eskalationsstufe.'; END IF;
  IF p_invoice_ids IS NULL OR array_length(p_invoice_ids,1) IS NULL THEN RAISE EXCEPTION 'Keine Rechnungen ausgewaehlt.'; END IF;

  FOREACH v_id IN ARRAY p_invoice_ids LOOP
    SELECT coalesce(i.legal_invoice_number, i.invoice_number), i.customer_id, i.customer_name, i.balance, i.currency
      INTO v_num, v_cust, v_cname, v_bal, v_cur
    FROM public.zoho_invoices i WHERE i.id = v_id;

    IF v_num IS NULL THEN
      invoice_id := v_id; invoice_number := NULL; ok := false; message := 'Rechnung nicht gefunden.';
      RETURN NEXT; CONTINUE;
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.op_light_escalations e
      WHERE e.invoice_id = v_id ORDER BY e.created_at DESC LIMIT 1
    ) AND (SELECT e.action = 'set' AND e.stage = p_stage FROM public.op_light_escalations e
           WHERE e.invoice_id = v_id ORDER BY e.created_at DESC LIMIT 1) THEN
      invoice_id := v_id; invoice_number := v_num; ok := false; message := 'Bereits uebergeben.';
      RETURN NEXT; CONTINUE;
    END IF;

    INSERT INTO public.op_light_escalations
      (invoice_id, invoice_number, customer_id, customer_name, stage, action, note, open_amount, currency)
    VALUES (v_id, v_num, v_cust, v_cname, p_stage, 'set', p_note, v_bal, v_cur);

    -- Mahnsperre setzen, damit kein regulaeres Mahnwesen weiterlaeuft
    INSERT INTO public.op_light_case_events (invoice_id, invoice_number, action, reason, note, pause_until)
    VALUES (v_id, v_num, 'set',
            CASE WHEN p_stage = 'anwalt' THEN 'Rechtsfall' ELSE 'Internes Inkasso' END,
            coalesce(p_note, 'Uebergabe an ' || CASE WHEN p_stage='anwalt' THEN 'Anwalt' ELSE 'internes Inkasso' END),
            NULL);

    PERFORM public.log_audit_event('FIBU_LIGHT_ESCALATION_SET','fibu-light', v_id::text,
      jsonb_build_object('stage', p_stage, 'invoice_number', v_num, 'open_amount', v_bal, 'note', p_note), NULL, NULL);

    v_cnt := v_cnt + 1;
    invoice_id := v_id; invoice_number := v_num; ok := true; message := 'Uebergeben.';
    RETURN NEXT;
  END LOOP;
END; $$;

-- Rueckholung
CREATE OR REPLACE FUNCTION public.fibu_light_clear_escalation(p_invoice_id uuid, p_note text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_num text; v_stage text; v_new uuid;
BEGIN
  IF NOT public.can_use_fibu_light() THEN RAISE EXCEPTION 'Keine Berechtigung fuer FIBU LIGHT.'; END IF;
  SELECT e.stage INTO v_stage FROM public.op_light_escalations e
   WHERE e.invoice_id = p_invoice_id ORDER BY e.created_at DESC LIMIT 1;
  IF v_stage IS NULL THEN RAISE EXCEPTION 'Keine Eskalation vorhanden.'; END IF;
  SELECT coalesce(legal_invoice_number, invoice_number) INTO v_num FROM public.zoho_invoices WHERE id = p_invoice_id;

  INSERT INTO public.op_light_escalations (invoice_id, invoice_number, stage, action, note)
  VALUES (p_invoice_id, v_num, v_stage, 'clear', p_note) RETURNING id INTO v_new;

  PERFORM public.log_audit_event('FIBU_LIGHT_ESCALATION_CLEAR','fibu-light', p_invoice_id::text,
    jsonb_build_object('stage', v_stage, 'invoice_number', v_num, 'note', p_note), NULL, NULL);
  RETURN v_new;
END; $$;

REVOKE ALL ON FUNCTION public.fibu_light_set_escalation(uuid[], text, text) FROM public, anon;
REVOKE ALL ON FUNCTION public.fibu_light_clear_escalation(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.fibu_light_set_escalation(uuid[], text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fibu_light_clear_escalation(uuid, text) TO authenticated;

-- Liste um Eskalationsfelder erweitern (additiv)
DROP FUNCTION IF EXISTS public.fibu_light_open_items();
CREATE FUNCTION public.fibu_light_open_items()
 RETURNS TABLE(id uuid, invoice_number text, legal_invoice_number text, customer_id text, customer_name text, invoice_date date, due_date date, total numeric, balance numeric, paid numeric, currency text, status text, payment_status text, zoho_invoice_id text, source_system text, days_overdue integer, dunning_level smallint, last_action_at timestamp with time zone, last_action text, case_active boolean, case_reason text, case_note text, case_pause_until date, plan_id uuid, plan_installments smallint, next_rate_amount numeric, next_rate_due date, next_action_level smallint, escalation_stage text, escalation_at timestamp with time zone, escalation_note text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
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
         END AS next_action_level,
         CASE WHEN e.action = 'set' THEN e.stage END AS escalation_stage,
         CASE WHEN e.action = 'set' THEN e.created_at END AS escalation_at,
         CASE WHEN e.action = 'set' THEN e.note END AS escalation_note
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
    SELECT es.action, es.stage, es.created_at, es.note
    FROM public.op_light_escalations es
    WHERE es.invoice_id = i.id ORDER BY es.created_at DESC LIMIT 1
  ) e ON true
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
$function$;

REVOKE ALL ON FUNCTION public.fibu_light_open_items() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.fibu_light_open_items() TO authenticated;