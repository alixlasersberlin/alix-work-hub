ALTER TABLE public.lager_devices ADD COLUMN IF NOT EXISTS delivered_order_id uuid;
CREATE INDEX IF NOT EXISTS idx_lager_devices_delivered_order_id ON public.lager_devices(delivered_order_id);

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
       SET delivered_order_id = NEW.id,
           reserved_order_id = NULL,
           updated_at = now()
     WHERE reserved_order_id = NEW.id;

    UPDATE public.route_plans
       SET planning_status = 'erledigt',
           updated_at = now()
     WHERE order_id = NEW.id
       AND COALESCE(planning_status, '') NOT IN ('erledigt', 'abgesagt', 'storniert');

    UPDATE public.production_orders
       SET status = 'erledigt',
           updated_at = now()
     WHERE order_id = NEW.id
       AND COALESCE(status, '') NOT IN ('erledigt', 'abgesagt', 'storniert');
  END IF;
  RETURN NEW;
END;
$function$;