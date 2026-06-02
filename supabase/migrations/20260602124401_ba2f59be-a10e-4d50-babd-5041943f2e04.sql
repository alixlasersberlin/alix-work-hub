-- Trigger function: clear lager reservations when order becomes 'geliefert'
CREATE OR REPLACE FUNCTION public.clear_lager_reservation_on_delivery()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.order_status = 'geliefert'
     AND (OLD.order_status IS DISTINCT FROM NEW.order_status) THEN
    UPDATE public.lager_devices
       SET reserved_order_id = NULL,
           updated_at = now()
     WHERE reserved_order_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clear_lager_reservation_on_delivery ON public.orders;
CREATE TRIGGER trg_clear_lager_reservation_on_delivery
AFTER UPDATE OF order_status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.clear_lager_reservation_on_delivery();

-- One-time backfill: clear reservations for already delivered orders
UPDATE public.lager_devices ld
   SET reserved_order_id = NULL,
       updated_at = now()
  FROM public.orders o
 WHERE ld.reserved_order_id = o.id
   AND o.order_status = 'geliefert';
