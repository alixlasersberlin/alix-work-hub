
ALTER TABLE public.number_ranges
  ADD COLUMN IF NOT EXISTS inherit_case boolean NOT NULL DEFAULT false;

ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS case_number text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS case_number text;
CREATE INDEX IF NOT EXISTS idx_offers_case_number ON public.offers (case_number);
CREATE INDEX IF NOT EXISTS idx_orders_case_number ON public.orders (case_number);

-- Seed master "case" range (inactive by default; admin must activate)
INSERT INTO public.number_ranges
  (code, label, prefix, separator, include_year, padding, start_value, current_value, reset_yearly, active, inherit_case, notes)
VALUES
  ('case','Vorgangs-Stammnummer','', '-', true, 5, 1, 0, true, false, false,
   'Master-Nummer für jeden Vorgang. Wird einmal beim Angebot vergeben und an alle Folge-Dokumente vererbt.')
ON CONFLICT (code) DO NOTHING;

-- New RPC: vergibt eine neue Stammnummer
CREATE OR REPLACE FUNCTION public.next_case_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r        public.number_ranges%ROWTYPE;
  cur_year int := EXTRACT(YEAR FROM (now() AT TIME ZONE 'Europe/Berlin'))::int;
  next_val bigint;
BEGIN
  SELECT * INTO r FROM public.number_ranges WHERE code = 'case' FOR UPDATE;
  IF NOT FOUND OR r.active = false THEN
    RETURN NULL;
  END IF;

  IF r.reset_yearly AND (r.last_reset_year IS NULL OR r.last_reset_year <> cur_year) THEN
    next_val := GREATEST(r.start_value, 1);
    UPDATE public.number_ranges
       SET current_value = next_val, last_reset_year = cur_year, updated_at = now()
     WHERE code = 'case';
  ELSE
    next_val := GREATEST(r.current_value + 1, r.start_value);
    UPDATE public.number_ranges
       SET current_value = next_val, updated_at = now()
     WHERE code = 'case';
  END IF;

  RETURN public.format_document_number(r.prefix, r.separator, r.include_year, r.padding, next_val, cur_year);
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_case_number() TO authenticated, service_role;

-- Erweiterte RPC: next_document_number mit optionaler Stammnummer
CREATE OR REPLACE FUNCTION public.next_document_number(p_code text, p_case_number text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r        public.number_ranges%ROWTYPE;
  cur_year int := EXTRACT(YEAR FROM (now() AT TIME ZONE 'Europe/Berlin'))::int;
  next_val bigint;
BEGIN
  SELECT * INTO r FROM public.number_ranges WHERE code = p_code FOR UPDATE;
  IF NOT FOUND OR r.active = false THEN
    RETURN NULL;
  END IF;

  -- Suffix-Modus: an Vorgangsnummer koppeln
  IF r.inherit_case = true AND p_case_number IS NOT NULL AND length(trim(p_case_number)) > 0 THEN
    RETURN COALESCE(NULLIF(r.prefix,''), '')
           || CASE WHEN r.prefix IS NOT NULL AND length(r.prefix) > 0 THEN r.separator ELSE '' END
           || p_case_number;
  END IF;

  IF r.reset_yearly AND (r.last_reset_year IS NULL OR r.last_reset_year <> cur_year) THEN
    next_val := GREATEST(r.start_value, 1);
    UPDATE public.number_ranges
       SET current_value = next_val, last_reset_year = cur_year, updated_at = now()
     WHERE code = p_code;
  ELSE
    next_val := GREATEST(r.current_value + 1, r.start_value);
    UPDATE public.number_ranges
       SET current_value = next_val, updated_at = now()
     WHERE code = p_code;
  END IF;

  RETURN public.format_document_number(r.prefix, r.separator, r.include_year, r.padding, next_val, cur_year);
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_document_number(text, text) TO authenticated, service_role;
