CREATE OR REPLACE FUNCTION public.next_case_number()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r        public.number_ranges%ROWTYPE;
  cur_year int := EXTRACT(YEAR FROM (now() AT TIME ZONE 'Europe/Berlin'))::int;
  next_val bigint;
  candidate text;
  guard int := 0;
BEGIN
  SELECT * INTO r FROM public.number_ranges WHERE code = 'case' FOR UPDATE;
  IF NOT FOUND OR r.active = false THEN
    RETURN NULL;
  END IF;

  IF r.reset_yearly AND (r.last_reset_year IS NULL OR r.last_reset_year <> cur_year) THEN
    next_val := GREATEST(r.start_value, 1);
  ELSE
    next_val := GREATEST(r.current_value + 1, r.start_value);
  END IF;

  LOOP
    guard := guard + 1;
    candidate := public.format_document_number(r.prefix, r.separator, r.include_year, r.padding, next_val, cur_year);

    -- Kollisionsschutz: beide Schreibweisen prüfen (mit und ohne AB-Präfix)
    EXIT WHEN guard > 1000 OR NOT EXISTS (
      SELECT 1 FROM public.orders o
       WHERE o.order_number = candidate
          OR o.order_number = 'AB-' || candidate
          OR 'AB-' || o.order_number = candidate
    );

    next_val := next_val + 1;
  END LOOP;

  IF r.reset_yearly AND (r.last_reset_year IS NULL OR r.last_reset_year <> cur_year) THEN
    UPDATE public.number_ranges
       SET current_value = next_val, last_reset_year = cur_year, updated_at = now()
     WHERE code = 'case';
  ELSE
    UPDATE public.number_ranges
       SET current_value = next_val, updated_at = now()
     WHERE code = 'case';
  END IF;

  RETURN candidate;
END;
$function$;