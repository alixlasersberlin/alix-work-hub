
CREATE OR REPLACE FUNCTION public.ods_default_row(_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_base date;
  v_order_eta date;
  v_planned date;
  v_from_order boolean := false;
  v_prod jsonb := '[{"key":"housing","label":"Gehäusemontage","status":"pending"},{"key":"electronics","label":"Elektronik","status":"pending"},{"key":"cooling","label":"Kühlsystem","status":"pending"},{"key":"laser","label":"Laserquelle","status":"pending"},{"key":"handpiece","label":"Handstück","status":"pending"},{"key":"software","label":"Software / KI","status":"pending"},{"key":"assembly","label":"Endmontage","status":"pending"}]'::jsonb;
  v_qc jsonb := '[{"key":"electric","label":"Elektrische Prüfung","status":"pending"},{"key":"power","label":"Laserleistungsprüfung","status":"pending"},{"key":"cooling","label":"Kühlsystem","status":"pending"},{"key":"software","label":"Softwareprüfung","status":"pending"},{"key":"safety","label":"Sicherheitsprüfung","status":"pending"},{"key":"function","label":"Funktionsprüfung","status":"pending"},{"key":"final","label":"Endkontrolle","status":"pending"}]'::jsonb;
BEGIN
  SELECT COALESCE(o.order_date::date, o.created_at::date, CURRENT_DATE), o.expected_shipment_date::date
    INTO v_base, v_order_eta
  FROM public.orders o WHERE o.id = _order_id;
  IF v_base IS NULL THEN RETURN; END IF;

  IF v_order_eta IS NOT NULL THEN
    v_planned := v_order_eta;
    v_from_order := true;
  ELSE
    v_planned := v_base + INTERVAL '3 months';
  END IF;

  INSERT INTO public.order_delivery_status (
    order_id, phase, sub_status,
    production_end_planned,
    production_steps, qc_steps,
    eta_earliest, eta_planned, eta_latest, eta_confirmed,
    time_window_start, time_window_end,
    is_delayed, partial_delivery,
    customer_note, notify_customer, notify_sms,
    priority, eta_state, traffic_light,
    address_confirmed, delivery_conditions, onsite_contact,
    confirm_due_date, confirm_reminder_count, show_contact_to_customer
  ) VALUES (
    _order_id, 'auto',
    CASE WHEN v_from_order THEN 'Liefertermin aus Auftrag übernommen' ELSE 'Standardplanung: 3 Monate ab Auftragseingang' END,
    v_planned - INTERVAL '21 days',
    v_prod, v_qc,
    v_planned - INTERVAL '14 days', v_planned, v_planned + INTERVAL '14 days', false,
    '08:00', '16:00',
    false, false,
    'Ihr ALIX System ist eingeplant. Sobald die Tour steht, erhalten Sie den verbindlichen Liefertermin.',
    true, false,
    'normal', 'forecast', 'gruen',
    false, '{}'::jsonb, '{}'::jsonb,
    v_planned - INTERVAL '14 days', 0, false
  )
  ON CONFLICT (order_id) DO UPDATE SET
    eta_planned = CASE WHEN v_from_order THEN EXCLUDED.eta_planned ELSE COALESCE(public.order_delivery_status.eta_planned, EXCLUDED.eta_planned) END,
    eta_earliest = CASE WHEN v_from_order THEN EXCLUDED.eta_earliest ELSE COALESCE(public.order_delivery_status.eta_earliest, EXCLUDED.eta_earliest) END,
    eta_latest = CASE WHEN v_from_order THEN EXCLUDED.eta_latest ELSE COALESCE(public.order_delivery_status.eta_latest, EXCLUDED.eta_latest) END,
    production_end_planned = CASE WHEN v_from_order THEN EXCLUDED.production_end_planned ELSE COALESCE(public.order_delivery_status.production_end_planned, EXCLUDED.production_end_planned) END,
    confirm_due_date = CASE WHEN v_from_order THEN EXCLUDED.confirm_due_date ELSE COALESCE(public.order_delivery_status.confirm_due_date, EXCLUDED.confirm_due_date) END,
    sub_status = CASE WHEN v_from_order THEN EXCLUDED.sub_status ELSE COALESCE(public.order_delivery_status.sub_status, EXCLUDED.sub_status) END,
    production_steps = CASE WHEN jsonb_array_length(COALESCE(public.order_delivery_status.production_steps,'[]'::jsonb)) = 0 THEN EXCLUDED.production_steps ELSE public.order_delivery_status.production_steps END,
    qc_steps = CASE WHEN jsonb_array_length(COALESCE(public.order_delivery_status.qc_steps,'[]'::jsonb)) = 0 THEN EXCLUDED.qc_steps ELSE public.order_delivery_status.qc_steps END,
    time_window_start = COALESCE(public.order_delivery_status.time_window_start, EXCLUDED.time_window_start),
    time_window_end = COALESCE(public.order_delivery_status.time_window_end, EXCLUDED.time_window_end),
    customer_note = COALESCE(public.order_delivery_status.customer_note, EXCLUDED.customer_note),
    eta_state = COALESCE(public.order_delivery_status.eta_state, EXCLUDED.eta_state),
    traffic_light = COALESCE(public.order_delivery_status.traffic_light, EXCLUDED.traffic_light);
END;
$$;

REVOKE ALL ON FUNCTION public.ods_default_row(uuid) FROM PUBLIC, anon, authenticated;

-- Lieferdatum-Änderungen im Auftrag in den Portal-Lieferstatus übernehmen
CREATE OR REPLACE FUNCTION public.ods_on_order_eta_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.expected_shipment_date IS DISTINCT FROM OLD.expected_shipment_date THEN
    PERFORM public.ods_default_row(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.ods_on_order_eta_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_ods_order_eta_change ON public.orders;
CREATE TRIGGER trg_ods_order_eta_change
AFTER UPDATE OF expected_shipment_date ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.ods_on_order_eta_change();

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.orders LOOP
    PERFORM public.ods_default_row(r.id);
  END LOOP;
END $$;
