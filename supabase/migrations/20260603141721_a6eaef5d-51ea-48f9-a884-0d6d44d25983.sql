CREATE OR REPLACE FUNCTION public.clear_lager_reservation_on_delivery()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.order_status = 'geliefert'
     AND (OLD.order_status IS DISTINCT FROM NEW.order_status) THEN
    UPDATE public.lager_devices
       SET reserved_order_id = NULL,
           updated_at = now()
     WHERE reserved_order_id = NEW.id;

    UPDATE public.route_plans
       SET planning_status = 'erledigt',
           updated_at = now()
     WHERE order_id = NEW.id
       AND COALESCE(planning_status, '') NOT IN ('erledigt', 'abgesagt', 'storniert');
  END IF;
  RETURN NEW;
END;
$function$;

-- Bestehende offene Route-Plan-Einträge für bereits gelieferte Aufträge nachziehen
UPDATE public.route_plans rp
   SET planning_status = 'erledigt',
       updated_at = now()
  FROM public.orders o
 WHERE rp.order_id = o.id
   AND o.order_status = 'geliefert'
   AND COALESCE(rp.planning_status, '') NOT IN ('erledigt', 'abgesagt', 'storniert');