
CREATE OR REPLACE FUNCTION public.dispatch_sync_appointment_to_calendar(p_appointment_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  a public.delivery_appointments%ROWTYPE;
  v_dep uuid;
  v_start timestamptz;
  v_end timestamptz;
  v_addr text;
  v_title text;
  v_desc text;
  v_event uuid;
BEGIN
  SELECT * INTO a FROM public.delivery_appointments WHERE id = p_appointment_id;
  IF NOT FOUND OR a.planned_date IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT id INTO v_dep FROM public.esc_departments WHERE name = 'Lieferung' LIMIT 1;
  IF v_dep IS NULL THEN
    SELECT id INTO v_dep FROM public.esc_departments ORDER BY name LIMIT 1;
  END IF;
  IF v_dep IS NULL THEN
    RETURN NULL;
  END IF;

  v_start := (a.planned_date::text || ' ' || COALESCE(a.time_window_start::text, '08:00:00'))::timestamp AT TIME ZONE 'Europe/Berlin';
  v_end := CASE
    WHEN a.time_window_end IS NOT NULL
      THEN (a.planned_date::text || ' ' || a.time_window_end::text)::timestamp AT TIME ZONE 'Europe/Berlin'
    ELSE v_start + (COALESCE(a.duration_minutes, 90) || ' minutes')::interval
  END;
  IF v_end <= v_start THEN
    v_end := v_start + (COALESCE(a.duration_minutes, 90) || ' minutes')::interval;
  END IF;

  v_addr := NULLIF(btrim(
    COALESCE(a.delivery_street, '') || CASE WHEN a.delivery_street IS NOT NULL THEN ', ' ELSE '' END ||
    COALESCE(a.delivery_zip, '') || ' ' || COALESCE(a.delivery_city, '') ||
    CASE WHEN a.delivery_country IS NOT NULL THEN ', ' || a.delivery_country ELSE '' END
  ), '');

  v_title := CASE WHEN a.is_vip THEN '👑 ' ELSE '' END
    || COALESCE(a.appointment_type::text, 'auslieferung')
    || ': ' || COALESCE(NULLIF(a.company_name, ''), a.customer_name, 'Kunde')
    || COALESCE(' – ' || a.order_number, '');

  v_desc := concat_ws(E'\n',
    'Kunde: ' || COALESCE(a.customer_name, '-'),
    CASE WHEN a.company_name IS NOT NULL THEN 'Firma: ' || a.company_name END,
    CASE WHEN a.customer_number IS NOT NULL THEN 'Kundennr.: ' || a.customer_number END,
    'Auftrag: ' || COALESCE(a.order_number, '-'),
    CASE WHEN a.invoice_number IS NOT NULL THEN 'Rechnung: ' || a.invoice_number END,
    'Terminart: ' || COALESCE(a.appointment_type::text, '-'),
    'Status: ' || COALESCE(a.status::text, '-'),
    'Bereitschaft: ' || COALESCE(a.readiness::text, '-'),
    'Adresse: ' || COALESCE(v_addr, '-'),
    'Ansprechpartner: ' || COALESCE(a.contact_name, '-'),
    'Telefon: ' || COALESCE(a.contact_phone, a.contact_mobile, '-'),
    'E-Mail: ' || COALESCE(a.contact_email, '-'),
    'Gerät: ' || COALESCE(a.device_name, a.article_name, '-'),
    CASE WHEN a.device_model IS NOT NULL THEN 'Modell: ' || a.device_model END,
    CASE WHEN a.serial_number IS NOT NULL THEN 'Seriennr.: ' || a.serial_number END,
    CASE WHEN a.accessories IS NOT NULL THEN 'Zubehör: ' || a.accessories END,
    CASE WHEN a.scope_of_delivery IS NOT NULL THEN 'Lieferumfang: ' || a.scope_of_delivery END,
    'Zeitfenster: ' || COALESCE(a.time_window_start::text, '-') || ' – ' || COALESCE(a.time_window_end::text, '-'),
    'Dauer: ' || COALESCE(a.duration_minutes, 90)::text || ' Min.',
    CASE WHEN a.salesperson_name IS NOT NULL THEN 'Verkäufer: ' || a.salesperson_name END,
    CASE WHEN a.payment_status IS NOT NULL THEN 'Zahlung: ' || a.payment_status END,
    CASE WHEN a.open_amount IS NOT NULL THEN 'Offener Betrag: ' || a.open_amount::text END,
    CASE WHEN a.financing_type IS NOT NULL THEN 'Finanzierung: ' || a.financing_type END,
    CASE WHEN a.requires_training THEN 'Einweisung/Schulung erforderlich' END,
    CASE WHEN a.requires_nisv_docs THEN 'NiSV-Dokumente erforderlich' END
  );

  IF a.esc_event_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.esc_events e WHERE e.id = a.esc_event_id) THEN
    UPDATE public.esc_events SET
      title = v_title, description = v_desc, start_at = v_start, end_at = v_end,
      department_id = COALESCE(department_id, v_dep),
      location = NULLIF(btrim(COALESCE(a.delivery_zip, '') || ' ' || COALESCE(a.delivery_city, '')), ''),
      address = v_addr,
      customer_id = a.customer_id, customer_name = COALESCE(a.company_name, a.customer_name),
      customer_email = a.contact_email, customer_phone = COALESCE(a.contact_phone, a.contact_mobile),
      contact_person = a.contact_name,
      assigned_user_id = COALESCE(a.responsible_user_id, assigned_user_id),
      internal_note = a.internal_notes, external_note = a.customer_notes,
      priority = CASE WHEN a.is_vip THEN 'high' ELSE COALESCE(a.priority, 'normal') END,
      event_kind = 'delivery', source = 'dispatch',
      appointment_status = COALESCE(a.status::text, 'geplant'),
      deleted_at = NULL,
      updated_at = now()
    WHERE id = a.esc_event_id;
    RETURN a.esc_event_id;
  END IF;

  INSERT INTO public.esc_events (
    title, description, start_at, end_at, department_id, location, address,
    customer_id, customer_name, customer_email, customer_phone, contact_person,
    assigned_user_id, internal_note, external_note, priority, event_kind, source,
    appointment_status, requires_confirmation, confirmation_status
  ) VALUES (
    v_title, v_desc, v_start, v_end, v_dep,
    NULLIF(btrim(COALESCE(a.delivery_zip, '') || ' ' || COALESCE(a.delivery_city, '')), ''),
    v_addr, a.customer_id, COALESCE(a.company_name, a.customer_name), a.contact_email,
    COALESCE(a.contact_phone, a.contact_mobile), a.contact_name, a.responsible_user_id,
    a.internal_notes, a.customer_notes,
    CASE WHEN a.is_vip THEN 'high' ELSE COALESCE(a.priority, 'normal') END,
    'delivery', 'dispatch', COALESCE(a.status::text, 'geplant'),
    true, CASE WHEN a.confirmed_at IS NOT NULL THEN 'confirmed' ELSE 'pending' END
  ) RETURNING id INTO v_event;

  UPDATE public.delivery_appointments SET esc_event_id = v_event WHERE id = a.id;
  RETURN v_event;
END;
$$;

CREATE OR REPLACE FUNCTION public.dispatch_sync_all_appointments_to_calendar()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r record; n integer := 0;
BEGIN
  FOR r IN SELECT id FROM public.delivery_appointments WHERE planned_date IS NOT NULL LOOP
    IF public.dispatch_sync_appointment_to_calendar(r.id) IS NOT NULL THEN
      n := n + 1;
    END IF;
  END LOOP;
  RETURN n;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_dispatch_calendar_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.esc_event_id IS NOT NULL THEN
      UPDATE public.esc_events SET deleted_at = now() WHERE id = OLD.esc_event_id;
    END IF;
    RETURN OLD;
  END IF;
  PERFORM public.dispatch_sync_appointment_to_calendar(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS delivery_appointments_calendar_sync ON public.delivery_appointments;
CREATE TRIGGER delivery_appointments_calendar_sync
AFTER INSERT OR UPDATE OF planned_date, time_window_start, time_window_end, duration_minutes,
  status, readiness, customer_name, company_name, contact_name, contact_phone, contact_mobile,
  contact_email, delivery_street, delivery_zip, delivery_city, delivery_country, device_name,
  device_model, serial_number, article_name, order_number, invoice_number, internal_notes,
  customer_notes, is_vip, priority, responsible_user_id, appointment_type
  OR DELETE ON public.delivery_appointments
FOR EACH ROW EXECUTE FUNCTION public.trg_dispatch_calendar_sync();

GRANT EXECUTE ON FUNCTION public.dispatch_sync_appointment_to_calendar(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dispatch_sync_all_appointments_to_calendar() TO authenticated;
