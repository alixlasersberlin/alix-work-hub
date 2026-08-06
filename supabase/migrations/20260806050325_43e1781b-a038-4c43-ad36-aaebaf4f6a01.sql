-- Fahrer dürfen Termine ihrer Tour aktualisieren
DROP POLICY IF EXISTS da_update_driver ON public.delivery_appointments;
CREATE POLICY da_update_driver ON public.delivery_appointments
FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.delivery_tour_stops s
  JOIN public.delivery_tours t ON t.id = s.tour_id
  WHERE s.appointment_id = delivery_appointments.id
    AND (t.driver_id IN (SELECT d.id FROM public.drivers d WHERE d.user_id = auth.uid())
      OR t.codriver_id IN (SELECT d.id FROM public.drivers d WHERE d.user_id = auth.uid()))
));

-- Beladungsliste automatisch aus Stopps erzeugen (umgekehrte Auslieferreihenfolge)
CREATE OR REPLACE FUNCTION public.delivery_generate_loading_list(p_tour_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_list_id uuid;
  v_pos int := 0;
  r record;
BEGIN
  IF NOT public.can_plan_delivery() THEN
    RAISE EXCEPTION 'Keine Berechtigung für die Tourenplanung';
  END IF;

  SELECT id INTO v_list_id FROM public.delivery_loading_lists WHERE tour_id = p_tour_id LIMIT 1;
  IF v_list_id IS NULL THEN
    INSERT INTO public.delivery_loading_lists (tour_id, status)
    VALUES (p_tour_id, 'offen') RETURNING id INTO v_list_id;
  ELSE
    DELETE FROM public.delivery_loading_items
    WHERE loading_list_id = v_list_id AND status = 'nicht_vorbereitet';
  END IF;

  FOR r IN
    SELECT s.appointment_id, a.device_name, a.article_name, a.serial_number, a.accessories, a.customer_name, a.order_number
    FROM public.delivery_tour_stops s
    JOIN public.delivery_appointments a ON a.id = s.appointment_id
    WHERE s.tour_id = p_tour_id
    ORDER BY s.position DESC
  LOOP
    v_pos := v_pos + 1;
    IF NOT EXISTS (
      SELECT 1 FROM public.delivery_loading_items i
      WHERE i.loading_list_id = v_list_id AND i.appointment_id = r.appointment_id AND i.item_type = 'geraet'
    ) THEN
      INSERT INTO public.delivery_loading_items
        (loading_list_id, appointment_id, position, item_type, description, serial_number, quantity, status)
      VALUES (v_list_id, r.appointment_id, v_pos, 'geraet',
        coalesce(r.device_name, r.article_name, 'Gerät') || ' – ' || coalesce(r.customer_name, '') ||
        coalesce(' (' || r.order_number || ')', ''),
        r.serial_number, 1, 'nicht_vorbereitet');
    END IF;

    IF r.accessories IS NOT NULL AND btrim(r.accessories) <> '' AND NOT EXISTS (
      SELECT 1 FROM public.delivery_loading_items i
      WHERE i.loading_list_id = v_list_id AND i.appointment_id = r.appointment_id AND i.item_type = 'zubehoer'
    ) THEN
      v_pos := v_pos + 1;
      INSERT INTO public.delivery_loading_items
        (loading_list_id, appointment_id, position, item_type, description, quantity, status)
      VALUES (v_list_id, r.appointment_id, v_pos, 'zubehoer', r.accessories, 1, 'nicht_vorbereitet');
    END IF;
  END LOOP;

  RETURN v_list_id;
END;
$$;

-- 15-Punkte-Freigabecheckliste anlegen
CREATE OR REPLACE FUNCTION public.delivery_seed_release_checklist(p_tour_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int := 0;
  items text[][] := ARRAY[
    ['fahrer','Fahrer zugewiesen und verfügbar','t'],
    ['fahrzeug','Fahrzeug zugewiesen und einsatzbereit','t'],
    ['hu','HU/Wartung des Fahrzeugs gültig','t'],
    ['fuehrerschein','Führerschein und Qualifikationen gültig','t'],
    ['zuladung','Zuladung und Volumen geprüft','t'],
    ['stopps','Alle Stopps terminiert und sortiert','t'],
    ['kundenbestaetigung','Kundenbestätigungen liegen vor','t'],
    ['zahlung','Zahlungsstatus je Auftrag geprüft','t'],
    ['geraete','Geräte inkl. Seriennummern verfügbar','t'],
    ['beladung','Beladungsliste vollständig abgehakt','t'],
    ['dokumente','Lieferscheine und Dokumente vorbereitet','t'],
    ['nisv','NiSV-/Schulungsunterlagen vorhanden','f'],
    ['route','Route berechnet und Arbeitszeit im Rahmen','f'],
    ['kontakt','Kontaktdaten und Adressen geprüft','f'],
    ['sonstiges','Sonstige Hinweise an Fahrer übermittelt','f']
  ];
  i int;
BEGIN
  IF NOT public.can_plan_delivery() THEN
    RAISE EXCEPTION 'Keine Berechtigung für die Tourenplanung';
  END IF;

  FOR i IN 1..array_length(items, 1) LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.delivery_checklists c
      WHERE c.tour_id = p_tour_id AND c.item_key = items[i][1]
    ) THEN
      INSERT INTO public.delivery_checklists (tour_id, item_key, label, is_blocking, is_done)
      VALUES (p_tour_id, items[i][1], items[i][2], items[i][3]::boolean, false);
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$;

-- Tour freigeben (nur wenn alle blockierenden Punkte erledigt)
CREATE OR REPLACE FUNCTION public.delivery_release_tour(p_tour_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_open int;
BEGIN
  IF NOT (public.has_role('Super Admin') OR public.has_role('Admin') OR public.can_plan_delivery()) THEN
    RAISE EXCEPTION 'Keine Berechtigung für die Tourfreigabe';
  END IF;

  SELECT count(*) INTO v_open
  FROM public.delivery_checklists
  WHERE tour_id = p_tour_id AND is_blocking AND NOT is_done;

  IF v_open > 0 THEN
    RETURN jsonb_build_object('ok', false, 'open_items', v_open);
  END IF;

  UPDATE public.delivery_tours
  SET status = 'freigegeben', released_by = auth.uid(), released_at = now()
  WHERE id = p_tour_id;

  UPDATE public.delivery_appointments a
  SET status = 'tour_freigegeben'
  FROM public.delivery_tour_stops s
  WHERE s.tour_id = p_tour_id AND s.appointment_id = a.id
    AND a.status NOT IN ('erfolgreich_ausgeliefert','abgeschlossen','storniert');

  RETURN jsonb_build_object('ok', true, 'open_items', 0);
END;
$$;