
CREATE OR REPLACE FUNCTION public.ods_default_row(_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_base date;
  v_planned date;
  v_prod jsonb := '[{"key":"housing","label":"Gehäusemontage","status":"pending"},{"key":"electronics","label":"Elektronik","status":"pending"},{"key":"cooling","label":"Kühlsystem","status":"pending"},{"key":"laser","label":"Laserquelle","status":"pending"},{"key":"handpiece","label":"Handstück","status":"pending"},{"key":"software","label":"Software / KI","status":"pending"},{"key":"assembly","label":"Endmontage","status":"pending"}]'::jsonb;
  v_qc jsonb := '[{"key":"electric","label":"Elektrische Prüfung","status":"pending"},{"key":"power","label":"Laserleistungsprüfung","status":"pending"},{"key":"cooling","label":"Kühlsystem","status":"pending"},{"key":"software","label":"Softwareprüfung","status":"pending"},{"key":"safety","label":"Sicherheitsprüfung","status":"pending"},{"key":"function","label":"Funktionsprüfung","status":"pending"},{"key":"final","label":"Endkontrolle","status":"pending"}]'::jsonb;
BEGIN
  SELECT COALESCE(o.order_date::date, o.created_at::date, CURRENT_DATE)
    INTO v_base
  FROM public.orders o WHERE o.id = _order_id;
  IF v_base IS NULL THEN RETURN; END IF;
  v_planned := v_base + INTERVAL '3 months';

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
    _order_id, 'auto', 'Standardplanung: 3 Monate ab Auftragseingang',
    v_planned - INTERVAL '21 days',
    v_prod, v_qc,
    v_planned - INTERVAL '14 days', v_planned, v_planned + INTERVAL '14 days', false,
    '08:00', '16:00',
    false, false,
    'Ihr ALIX System ist eingeplant. Der voraussichtliche Liefertermin liegt rund 3 Monate nach Auftragseingang; sobald die Tour steht, erhalten Sie den verbindlichen Termin.',
    true, false,
    'normal', 'forecast', 'gruen',
    false, '{}'::jsonb, '{}'::jsonb,
    v_planned - INTERVAL '14 days', 0, false
  )
  ON CONFLICT (order_id) DO UPDATE SET
    eta_planned = COALESCE(public.order_delivery_status.eta_planned, EXCLUDED.eta_planned),
    eta_earliest = COALESCE(public.order_delivery_status.eta_earliest, EXCLUDED.eta_earliest),
    eta_latest = COALESCE(public.order_delivery_status.eta_latest, EXCLUDED.eta_latest),
    production_end_planned = COALESCE(public.order_delivery_status.production_end_planned, EXCLUDED.production_end_planned),
    production_steps = CASE WHEN jsonb_array_length(COALESCE(public.order_delivery_status.production_steps,'[]'::jsonb)) = 0 THEN EXCLUDED.production_steps ELSE public.order_delivery_status.production_steps END,
    qc_steps = CASE WHEN jsonb_array_length(COALESCE(public.order_delivery_status.qc_steps,'[]'::jsonb)) = 0 THEN EXCLUDED.qc_steps ELSE public.order_delivery_status.qc_steps END,
    time_window_start = COALESCE(public.order_delivery_status.time_window_start, EXCLUDED.time_window_start),
    time_window_end = COALESCE(public.order_delivery_status.time_window_end, EXCLUDED.time_window_end),
    sub_status = COALESCE(public.order_delivery_status.sub_status, EXCLUDED.sub_status),
    customer_note = COALESCE(public.order_delivery_status.customer_note, EXCLUDED.customer_note),
    eta_state = COALESCE(public.order_delivery_status.eta_state, EXCLUDED.eta_state),
    traffic_light = COALESCE(public.order_delivery_status.traffic_light, EXCLUDED.traffic_light),
    confirm_due_date = COALESCE(public.order_delivery_status.confirm_due_date, EXCLUDED.confirm_due_date);
END;
$$;

CREATE OR REPLACE FUNCTION public.ods_on_order_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.ods_default_row(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ods_default_on_order_insert ON public.orders;
CREATE TRIGGER trg_ods_default_on_order_insert
AFTER INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.ods_on_order_insert();

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.orders LOOP
    PERFORM public.ods_default_row(r.id);
  END LOOP;
END $$;
