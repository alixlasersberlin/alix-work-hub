
-- 1) Trigger: reserved_order_id changes → sync [Status: ...] tag in notes
CREATE OR REPLACE FUNCTION public.sync_lager_status_on_reservation()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_notes text;
BEGIN
  v_notes := COALESCE(NEW.notes, '');

  -- newly reserved
  IF NEW.reserved_order_id IS NOT NULL
     AND (OLD.reserved_order_id IS DISTINCT FROM NEW.reserved_order_id) THEN
    IF v_notes ~ '\[Status:\s*Bestand\]' THEN
      v_notes := regexp_replace(v_notes, '\[Status:\s*Bestand\]', '[Status: Reserviert]', 'g');
    ELSIF v_notes !~ '\[Status:\s*[^\]]+\]' THEN
      v_notes := btrim(v_notes || ' [Status: Reserviert]');
    END IF;
    NEW.notes := v_notes;
  END IF;

  -- released
  IF NEW.reserved_order_id IS NULL AND OLD.reserved_order_id IS NOT NULL THEN
    IF v_notes ~ '\[Status:\s*Reserviert\]' THEN
      v_notes := regexp_replace(v_notes, '\[Status:\s*Reserviert\]', '[Status: Bestand]', 'g');
      NEW.notes := v_notes;
    END IF;
    NEW.reservation_week := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_lager_status_on_reservation ON public.lager_devices;
CREATE TRIGGER trg_sync_lager_status_on_reservation
BEFORE UPDATE OF reserved_order_id ON public.lager_devices
FOR EACH ROW EXECUTE FUNCTION public.sync_lager_status_on_reservation();

-- 2) Backfill: reserved devices still tagged as Bestand
UPDATE public.lager_devices
SET notes = regexp_replace(notes, '\[Status:\s*Bestand\]', '[Status: Reserviert]', 'g')
WHERE reserved_order_id IS NOT NULL
  AND notes ~ '\[Status:\s*Bestand\]';

-- 3) Auto-reservation when production_orders.approval_status → 'approved'
CREATE OR REPLACE FUNCTION public.reserve_lager_device_on_po_approval()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_device_id uuid;
  v_model text;
  v_already uuid;
BEGIN
  IF NEW.approval_status = 'approved'
     AND (OLD.approval_status IS DISTINCT FROM 'approved')
     AND NEW.order_id IS NOT NULL THEN

    -- Skip if this order already has a reserved device
    SELECT id INTO v_already
    FROM public.lager_devices
    WHERE reserved_order_id = NEW.order_id
    LIMIT 1;
    IF v_already IS NOT NULL THEN
      RETURN NEW;
    END IF;

    v_model := btrim(COALESCE(NEW.modellname, ''));
    IF length(v_model) < 3 THEN RETURN NEW; END IF;

    -- Find one free Bestand device whose model_name loosely matches
    SELECT id INTO v_device_id
    FROM public.lager_devices
    WHERE reserved_order_id IS NULL
      AND notes ~ '\[Status:\s*Bestand\]'
      AND (
        lower(model_name) LIKE '%' || lower(v_model) || '%'
        OR lower(v_model)     LIKE '%' || lower(model_name) || '%'
      )
    ORDER BY entry_date NULLS LAST, created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF v_device_id IS NOT NULL THEN
      UPDATE public.lager_devices
      SET reserved_order_id = NEW.order_id,
          updated_at = now()
      WHERE id = v_device_id AND reserved_order_id IS NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reserve_lager_device_on_po_approval ON public.production_orders;
CREATE TRIGGER trg_reserve_lager_device_on_po_approval
AFTER UPDATE OF approval_status ON public.production_orders
FOR EACH ROW EXECUTE FUNCTION public.reserve_lager_device_on_po_approval();
