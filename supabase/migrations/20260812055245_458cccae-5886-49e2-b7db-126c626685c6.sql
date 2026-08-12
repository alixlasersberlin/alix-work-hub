CREATE OR REPLACE FUNCTION public.fc_repair_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE s text; amt numeric;
BEGIN
  s := lower(COALESCE(NEW.repair_status,''));
  IF TG_OP = 'UPDATE'
     AND lower(COALESCE(OLD.repair_status,'')) = s
     AND COALESCE(OLD.actual_cost,0) = COALESCE(NEW.actual_cost,0)
     AND COALESCE(OLD.estimated_cost,0) = COALESCE(NEW.estimated_cost,0)
  THEN RETURN NEW; END IF;

  IF s IN ('reparatur abgeschlossen','an finance übergeben','an finance uebergeben','erledigt','abgeschlossen','ausgeliefert','an tourenplanung übergeben') THEN
    amt := COALESCE(NULLIF(NEW.actual_cost,0), NULLIF(NEW.estimated_cost,0),
                    (SELECT COALESCE(NULLIF(q.total_gross,0), NULLIF(q.total_net,0))
                       FROM public.repair_quotes q
                      WHERE q.repair_order_id = NEW.id
                      ORDER BY q.created_at DESC LIMIT 1), 0);
    IF COALESCE(amt,0) > 0 THEN
      PERFORM public.fc_upsert_case('REPARATUR','reparatur_abgeschlossen','repair_orders',NEW.id,NEW.order_id,NEW.customer_id,NEW.customer_name,NEW.repair_number,amt,NULL,false);
    END IF;
  END IF;
  RETURN NEW;
END; $function$;

DROP TRIGGER IF EXISTS trg_fc_repair ON public.repair_orders;
CREATE TRIGGER trg_fc_repair
AFTER INSERT OR UPDATE OF repair_status, actual_cost, estimated_cost ON public.repair_orders
FOR EACH ROW EXECUTE FUNCTION public.fc_repair_trigger();

-- Nachtrag: bereits übergebene Reparaturen in Finance Controlling aufnehmen
DO $$
DECLARE r record; amt numeric;
BEGIN
  FOR r IN SELECT * FROM public.repair_orders
           WHERE lower(COALESCE(repair_status,'')) IN
             ('reparatur abgeschlossen','an finance übergeben','an tourenplanung übergeben','ausgeliefert')
  LOOP
    amt := COALESCE(NULLIF(r.actual_cost,0), NULLIF(r.estimated_cost,0),
                    (SELECT COALESCE(NULLIF(q.total_gross,0), NULLIF(q.total_net,0))
                       FROM public.repair_quotes q WHERE q.repair_order_id = r.id
                       ORDER BY q.created_at DESC LIMIT 1), 0);
    IF COALESCE(amt,0) > 0 THEN
      PERFORM public.fc_upsert_case('REPARATUR','reparatur_abgeschlossen','repair_orders',r.id,r.order_id,r.customer_id,r.customer_name,r.repair_number,amt,NULL,false);
    END IF;
  END LOOP;
END $$;