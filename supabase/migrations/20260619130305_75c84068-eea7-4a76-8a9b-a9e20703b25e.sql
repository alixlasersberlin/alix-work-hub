CREATE OR REPLACE FUNCTION public.peek_document_number(p_code text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  r         public.number_ranges%ROWTYPE;
  c         public.number_ranges%ROWTYPE;
  cur_year  int := EXTRACT(YEAR FROM (now() AT TIME ZONE 'Europe/Berlin'))::int;
  next_val  bigint;
  case_val  bigint;
  case_str  text;
BEGIN
  SELECT * INTO r FROM public.number_ranges WHERE code = p_code;
  IF NOT FOUND THEN RETURN NULL; END IF;

  -- Suffix-Modus: Vorschau anhand der nächsten Stammnummer
  IF r.inherit_case = true AND r.active = true THEN
    SELECT * INTO c FROM public.number_ranges WHERE code = 'case';
    IF FOUND AND c.active = true THEN
      IF c.reset_yearly AND (c.last_reset_year IS NULL OR c.last_reset_year <> cur_year) THEN
        case_val := GREATEST(c.start_value, 1);
      ELSE
        case_val := GREATEST(c.current_value + 1, c.start_value);
      END IF;
      case_str := public.format_document_number(c.prefix, c.separator, c.include_year, c.padding, case_val, cur_year);
      RETURN COALESCE(NULLIF(r.prefix,''), '')
             || CASE WHEN r.prefix IS NOT NULL AND length(r.prefix) > 0 THEN r.separator ELSE '' END
             || case_str;
    END IF;
  END IF;

  IF r.reset_yearly AND (r.last_reset_year IS NULL OR r.last_reset_year <> cur_year) THEN
    next_val := GREATEST(r.start_value, 1);
  ELSE
    next_val := GREATEST(r.current_value + 1, r.start_value);
  END IF;

  RETURN public.format_document_number(r.prefix, r.separator, r.include_year, r.padding, next_val, cur_year);
END;
$function$;