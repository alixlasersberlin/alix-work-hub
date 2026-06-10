-- 1) Trigger function
CREATE OR REPLACE FUNCTION public.set_lager_in_produktion_on_send()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order_number text;
BEGIN
  IF NEW.status = 'gesendet'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status)
     AND NEW.order_id IS NOT NULL THEN

    SELECT order_number INTO v_order_number FROM public.orders WHERE id = NEW.order_id;

    UPDATE public.lager_devices ld
       SET notes = (
             CASE
               WHEN ld.notes ~* '\[Typ:\s*[^\]]+\]'
                 THEN regexp_replace(ld.notes, '\[Typ:\s*([^\]]+)\].*$', '[Typ: \1]')
               ELSE '[Typ: Neugerät]'
             END
           )
           || ' [Status: In Produktion]'
           || COALESCE(' ' || v_order_number, ''),
           updated_at = now()
     WHERE ld.reserved_order_id = NEW.order_id
       AND ld.delivered_order_id IS NULL
       AND (
            ld.notes IS NULL
         OR ld.notes ~* '\[Status:\s*(Shell Warehouse|Bestand|Transfer|Lager)\]'
       );
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_set_lager_in_produktion_on_send ON public.production_orders;
CREATE TRIGGER trg_set_lager_in_produktion_on_send
AFTER INSERT OR UPDATE OF status ON public.production_orders
FOR EACH ROW
EXECUTE FUNCTION public.set_lager_in_produktion_on_send();

-- 2) Backfill: alle bereits gesendeten Produktionsbestellungen einmalig nachziehen
UPDATE public.lager_devices ld
   SET notes = (
         CASE
           WHEN ld.notes ~* '\[Typ:\s*[^\]]+\]'
             THEN regexp_replace(ld.notes, '\[Typ:\s*([^\]]+)\].*$', '[Typ: \1]')
           ELSE '[Typ: Neugerät]'
         END
       )
       || ' [Status: In Produktion]'
       || COALESCE(' ' || o.order_number, ''),
       updated_at = now()
  FROM public.production_orders po
  JOIN public.orders o ON o.id = po.order_id
 WHERE ld.reserved_order_id = po.order_id
   AND ld.delivered_order_id IS NULL
   AND po.status = 'gesendet'
   AND (
        ld.notes IS NULL
     OR ld.notes ~* '\[Status:\s*(Shell Warehouse|Bestand|Transfer|Lager)\]'
   );