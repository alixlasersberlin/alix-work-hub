CREATE OR REPLACE FUNCTION public.gobd_number_range_guard()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'GoBD: Nummernkreise duerfen nicht geloescht werden.';
  END IF;
  IF NEW.last_value < OLD.last_value THEN
    RAISE EXCEPTION 'GoBD: Ein Nummernkreis darf nicht zurueckgesetzt werden (% -> %).', OLD.last_value, NEW.last_value;
  END IF;
  RETURN NEW;
END $function$;