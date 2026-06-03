-- Auto-release lager reservation and cancel production orders when order goes to 'Anwalt' or 'Hold'
CREATE OR REPLACE FUNCTION public.release_on_hold_or_lawyer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.order_status IN ('Anwalt', 'Hold')
     AND (OLD.order_status IS DISTINCT FROM NEW.order_status) THEN
    -- Lager-Reservierungen lösen
    UPDATE public.lager_devices
       SET reserved_order_id = NULL,
           updated_at = now()
     WHERE reserved_order_id = NEW.id;

    -- Produktions-Bestellungen stornieren
    UPDATE public.production_orders
       SET status = 'storniert',
           updated_at = now()
     WHERE order_id = NEW.id
       AND status IS DISTINCT FROM 'storniert';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_release_on_hold_or_lawyer ON public.orders;
CREATE TRIGGER trg_release_on_hold_or_lawyer
AFTER UPDATE OF order_status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.release_on_hold_or_lawyer();