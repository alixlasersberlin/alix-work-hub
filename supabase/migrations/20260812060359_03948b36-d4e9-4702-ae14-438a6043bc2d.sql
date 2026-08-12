CREATE OR REPLACE FUNCTION public.fc_upsert_case(p_case_type text, p_event text, p_table text, p_source_id uuid, p_order_id uuid, p_customer_id uuid, p_customer_name text, p_reference text, p_amount numeric, p_billing_flag text DEFAULT NULL::text, p_critical boolean DEFAULT false)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_inv numeric := 0; v_paid numeric := 0; v_total numeric := COALESCE(p_amount,0);
        v_open_inv numeric; v_open_pay numeric; v_traffic text; v_prio text; v_status text; v_id uuid;
BEGIN
  -- Reparaturen haben eigene Beträge (KV) und dürfen NICHT die Auftragsfinanzen übernehmen
  IF p_order_id IS NOT NULL AND p_case_type <> 'REPARATUR' THEN
    SELECT f.order_amount, f.invoiced, f.paid INTO v_total, v_inv, v_paid FROM public.fc_order_financials(p_order_id) f;
    IF COALESCE(v_total,0) = 0 THEN v_total := COALESCE(p_amount,0); END IF;
  END IF;
  v_open_inv := ROUND(COALESCE(v_total,0) - COALESCE(v_inv,0), 2);
  v_open_pay := ROUND(COALESCE(v_inv,0) - COALESCE(v_paid,0), 2);

  IF p_billing_flag IN ('garantie','kulanz') THEN
    v_traffic := 'gruen'; v_prio := 'normal'; v_status := 'pruefung_erforderlich';
  ELSIF v_open_inv <= 0.01 THEN
    v_traffic := 'gruen'; v_prio := 'normal'; v_status := 'rechnung_vorhanden';
  ELSIF p_critical THEN
    v_traffic := 'kritisch'; v_prio := 'kritisch'; v_status := 'rechnung_erforderlich';
  ELSE
    v_traffic := 'rot'; v_prio := 'hoch'; v_status := 'rechnung_erforderlich';
  END IF;

  INSERT INTO public.fc_cases (
    case_type, trigger_event, source_table, source_id, order_id, customer_id, customer_name,
    reference_number, order_amount, invoiced_amount, paid_amount, open_to_invoice, open_to_pay,
    status, priority, traffic, billing_flag
  ) VALUES (
    p_case_type, p_event, p_table, p_source_id, p_order_id, p_customer_id, p_customer_name,
    p_reference, COALESCE(v_total,0), COALESCE(v_inv,0), COALESCE(v_paid,0), v_open_inv, v_open_pay,
    v_status, v_prio, v_traffic, p_billing_flag
  )
  ON CONFLICT (source_table, source_id, trigger_event) DO UPDATE SET
    order_amount = EXCLUDED.order_amount,
    invoiced_amount = EXCLUDED.invoiced_amount,
    paid_amount = EXCLUDED.paid_amount,
    open_to_invoice = EXCLUDED.open_to_invoice,
    open_to_pay = EXCLUDED.open_to_pay,
    traffic = CASE WHEN public.fc_cases.status IN ('freigegeben','abgeschlossen') THEN public.fc_cases.traffic ELSE EXCLUDED.traffic END,
    updated_at = now()
  RETURNING id INTO v_id;

  INSERT INTO public.fc_events (case_id, event_type, new_status, comment)
  VALUES (v_id, p_event, v_status, 'Automatisch aus ' || p_table || ' erzeugt/aktualisiert');
  RETURN v_id;
END; $function$;

CREATE OR REPLACE FUNCTION public.fc_refresh_order(p_order_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE f record;
BEGIN
  SELECT * INTO f FROM public.fc_order_financials(p_order_id);
  UPDATE public.fc_cases c SET
    order_amount = f.order_amount,
    invoiced_amount = f.invoiced,
    paid_amount = f.paid,
    open_to_invoice = ROUND(f.order_amount - f.invoiced, 2),
    open_to_pay = ROUND(f.invoiced - f.paid, 2),
    traffic = CASE WHEN c.status IN ('freigegeben','abgeschlossen') THEN c.traffic
                   WHEN ROUND(f.order_amount - f.invoiced, 2) <= 0.01 THEN 'gruen'
                   WHEN c.priority = 'kritisch' THEN 'kritisch' ELSE 'rot' END,
    updated_at = now()
  WHERE c.order_id = p_order_id
    AND c.case_type <> 'REPARATUR';
END; $function$;

-- Bestehende Reparatur-Fälle auf den Reparatur-/KV-Betrag korrigieren
UPDATE public.fc_cases c SET
  order_amount = COALESCE(NULLIF(r.actual_cost,0), NULLIF(r.estimated_cost,0), q.total_gross, 0),
  invoiced_amount = 0,
  paid_amount = 0,
  open_to_invoice = ROUND(COALESCE(NULLIF(r.actual_cost,0), NULLIF(r.estimated_cost,0), q.total_gross, 0), 2),
  open_to_pay = 0,
  status = CASE WHEN c.status IN ('freigegeben','abgeschlossen') THEN c.status ELSE 'rechnung_erforderlich' END,
  traffic = CASE WHEN c.status IN ('freigegeben','abgeschlossen') THEN c.traffic ELSE 'rot' END,
  priority = CASE WHEN c.status IN ('freigegeben','abgeschlossen') THEN c.priority ELSE 'hoch' END,
  updated_at = now()
FROM public.repair_orders r
LEFT JOIN LATERAL (
  SELECT rq.total_gross FROM public.repair_quotes rq
  WHERE rq.repair_order_id = r.id AND rq.status = 'Freigegeben'
  ORDER BY rq.created_at DESC LIMIT 1
) q ON true
WHERE c.case_type = 'REPARATUR' AND c.source_table = 'repair_orders' AND c.source_id = r.id;