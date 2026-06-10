CREATE OR REPLACE FUNCTION public.clear_lager_reservation_on_delivery()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_type text;
BEGIN
  IF NEW.order_status = 'geliefert'
     AND (OLD.order_status IS DISTINCT FROM NEW.order_status) THEN

    UPDATE public.lager_devices ld
       SET delivered_order_id = NEW.id,
           reserved_order_id = NULL,
           notes = (
             CASE
               WHEN ld.notes ~* '\[Typ:\s*[^\]]+\]'
                 THEN regexp_replace(ld.notes, '\[Typ:\s*([^\]]+)\]', '[Typ: \1]')
               ELSE '[Typ: Neugerät]'
             END
           )
           || ' [Status: Ausgeliefert]'
           || COALESCE(' ' || NEW.order_number, ''),
           updated_at = now()
     WHERE ld.reserved_order_id = NEW.id;

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