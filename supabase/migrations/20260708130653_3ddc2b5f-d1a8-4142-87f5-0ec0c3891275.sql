CREATE OR REPLACE FUNCTION public.as_on_order_status_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_case_id uuid;
  v_device_id uuid;
BEGIN
  IF NEW.order_status IS NULL THEN RETURN NEW; END IF;
  IF NEW.order_status NOT IN ('approved','geliefert','teilgeliefert','versendet','invoiced') THEN
    RETURN NEW;
  END IF;

  -- Nur Aufträge ab 2000 EUR in After-Sales übernehmen
  IF COALESCE(NEW.total_amount, 0) < 2000 THEN
    RETURN NEW;
  END IF;

  IF EXISTS (SELECT 1 FROM public.as_cases WHERE order_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_device_id FROM public.lager_devices
    WHERE delivered_order_id = NEW.id OR reserved_order_id = NEW.id LIMIT 1;

  INSERT INTO public.as_cases (order_id, customer_id, device_id, sales_user_name, status, priority, traffic_light)
  VALUES (NEW.id, NEW.customer_id, v_device_id, NEW.salesperson_name, 'open', 'normal', 'yellow')
  RETURNING id INTO v_case_id;

  PERFORM public.as_seed_default_checklists(v_case_id);

  INSERT INTO public.as_timeline_events (case_id, event_type, title, body, source)
  VALUES (v_case_id, 'case_created', 'After-Sales-Fall automatisch erstellt',
          'Auslöser: Auftragsstatus = ' || NEW.order_status, 'system');

  RETURN NEW;
END $$;

-- Bestehende offene Fälle unter 2000 EUR entfernen
DELETE FROM public.as_cases c
USING public.orders o
WHERE c.order_id = o.id
  AND c.status <> 'completed'
  AND COALESCE(o.total_amount, 0) < 2000;