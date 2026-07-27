
CREATE OR REPLACE FUNCTION public.esc_store_appt_to_events()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d jsonb := NEW.data;
  v_start timestamptz;
  v_end timestamptz;
  v_priority text;
  v_status text;
  v_event_id uuid;
  v_dept_key text;
  v_dept_id uuid;
BEGIN
  v_start := NULLIF(d->>'startAt','')::timestamptz;
  v_end   := COALESCE(NULLIF(d->>'endAt','')::timestamptz, v_start + interval '1 hour');
  IF v_start IS NULL THEN RETURN NEW; END IF;

  v_priority := CASE lower(coalesce(d->>'priority','normal'))
    WHEN 'urgent' THEN 'urgent' WHEN 'high' THEN 'high' WHEN 'low' THEN 'low' ELSE 'normal' END;

  v_status := CASE lower(coalesce(d->>'status','geplant'))
    WHEN 'bestaetigt' THEN 'confirmed'
    WHEN 'bestaetigung_offen' THEN 'confirmation_pending'
    WHEN 'abgesagt' THEN 'cancelled'
    WHEN 'erledigt' THEN 'completed'
    ELSE 'planned' END;

  v_dept_key := lower(coalesce(d->>'departmentId',''));
  v_dept_key := CASE v_dept_key
    WHEN 'delivery' THEN 'lieferung'
    WHEN 'media' THEN 'mediapaket'
    WHEN 'training' THEN 'schulung'
    WHEN 'accounting' THEN 'buchhaltung'
    ELSE v_dept_key END;

  SELECT id INTO v_dept_id FROM public.esc_departments WHERE slug = v_dept_key LIMIT 1;
  IF v_dept_id IS NULL THEN
    SELECT id INTO v_dept_id FROM public.esc_departments WHERE slug = 'sales' LIMIT 1;
  END IF;
  IF v_dept_id IS NULL THEN
    SELECT id INTO v_dept_id FROM public.esc_departments ORDER BY created_at LIMIT 1;
  END IF;

  SELECT id INTO v_event_id FROM public.esc_events
    WHERE source = 'team_kalender' AND ics_uid = NEW.id LIMIT 1;

  IF v_event_id IS NULL THEN
    INSERT INTO public.esc_events (
      title, description, start_at, end_at, location, address,
      priority, status, department_id, customer_name, customer_email, customer_phone,
      internal_note, external_note, requires_confirmation,
      source, ics_uid, event_kind, created_at, updated_at
    ) VALUES (
      COALESCE(d->>'title','(ohne Titel)'), d->>'description', v_start, v_end,
      d->>'location', d->>'address', v_priority, v_status, v_dept_id,
      NULLIF(d->>'customerName',''), NULLIF(d->>'customerEmail',''), NULLIF(d->>'customerPhone',''),
      d->>'internalNote', d->>'externalNote',
      COALESCE((d->>'confirmationRequired')::boolean, false),
      'team_kalender', NEW.id, COALESCE(d->>'kind','appointment'),
      COALESCE(NULLIF(d->>'createdAt','')::timestamptz, now()),
      COALESCE(NULLIF(d->>'updatedAt','')::timestamptz, now())
    );
  ELSE
    UPDATE public.esc_events SET
      title = COALESCE(d->>'title', title), description = d->>'description',
      start_at = v_start, end_at = v_end,
      location = d->>'location', address = d->>'address',
      priority = v_priority, status = v_status, department_id = v_dept_id,
      customer_name = NULLIF(d->>'customerName',''),
      customer_email = NULLIF(d->>'customerEmail',''),
      customer_phone = NULLIF(d->>'customerPhone',''),
      internal_note = d->>'internalNote', external_note = d->>'externalNote',
      requires_confirmation = COALESCE((d->>'confirmationRequired')::boolean, false),
      event_kind = COALESCE(d->>'kind', event_kind),
      updated_at = now()
    WHERE id = v_event_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_esc_store_appt_to_events ON public.esc_store_appointments;
CREATE TRIGGER trg_esc_store_appt_to_events
AFTER INSERT OR UPDATE ON public.esc_store_appointments
FOR EACH ROW EXECUTE FUNCTION public.esc_store_appt_to_events();

UPDATE public.esc_store_appointments SET updated_at = updated_at;
