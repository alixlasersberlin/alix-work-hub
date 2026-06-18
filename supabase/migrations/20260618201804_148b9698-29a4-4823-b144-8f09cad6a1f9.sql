
-- =========================================================
-- Nummernkreise: zentrale Vorgangs- und Dokumentnummern
-- =========================================================

CREATE TABLE IF NOT EXISTS public.number_ranges (
  code              text PRIMARY KEY,
  label             text NOT NULL,
  prefix            text NOT NULL DEFAULT '',
  separator         text NOT NULL DEFAULT '-',
  include_year      boolean NOT NULL DEFAULT true,
  padding           int NOT NULL DEFAULT 5 CHECK (padding BETWEEN 0 AND 12),
  start_value       bigint NOT NULL DEFAULT 1,
  current_value     bigint NOT NULL DEFAULT 0,
  reset_yearly      boolean NOT NULL DEFAULT true,
  last_reset_year   int,
  active            boolean NOT NULL DEFAULT false,
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  updated_by        uuid
);

GRANT SELECT, INSERT, UPDATE ON public.number_ranges TO authenticated;
GRANT ALL ON public.number_ranges TO service_role;

ALTER TABLE public.number_ranges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "number_ranges super admin select"
  ON public.number_ranges FOR SELECT TO authenticated
  USING (public.has_role('Super Admin'));

CREATE POLICY "number_ranges super admin insert"
  ON public.number_ranges FOR INSERT TO authenticated
  WITH CHECK (public.has_role('Super Admin'));

CREATE POLICY "number_ranges super admin update"
  ON public.number_ranges FOR UPDATE TO authenticated
  USING (public.has_role('Super Admin'))
  WITH CHECK (public.has_role('Super Admin'));

CREATE TRIGGER number_ranges_set_updated_at
  BEFORE UPDATE ON public.number_ranges
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER number_ranges_set_updated_by
  BEFORE INSERT OR UPDATE ON public.number_ranges
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_by();

-- ---------------------------------------------------------
-- Seed (alle inaktiv -> bestehende Legacy-Logik bleibt aktiv)
-- ---------------------------------------------------------
INSERT INTO public.number_ranges (code, label, prefix, padding, start_value, current_value, reset_yearly, include_year, active)
VALUES
  ('offer',         'Angebot',                       'ANG',  5, 1, 0, true,  true,  false),
  ('order',         'Auftragsbestätigung',           'AB',   5, 1, 0, true,  true,  false),
  ('delivery_note', 'Lieferschein',                  'LS',   5, 1, 0, true,  true,  false),
  ('invoice',       'Rechnung',                      'RG',   5, 1, 0, true,  true,  false),
  ('credit_note',   'Gutschrift',                    'GU',   5, 1, 0, true,  true,  false),
  ('repair',        'Reparaturauftrag',              'REP',  6, 1, 0, true,  true,  false),
  ('repair_quote',  'Reparatur-Kostenvoranschlag',   'KV',   5, 1, 0, true,  true,  false),
  ('work_order',    'Werkstattauftrag',              'WA',   5, 1, 0, true,  true,  false),
  ('ticket',        'Support-Ticket',                'TKT',  6, 1, 0, true,  true,  false),
  ('production',    'Produktionsauftrag',            'PRD',  5, 1, 0, true,  true,  false),
  ('purchase',      'Bestellung Lieferant',          'BST',  5, 1, 0, true,  true,  false),
  ('goods_receipt', 'Wareneingang',                  'WE',   5, 1, 0, true,  true,  false),
  ('bank_request',  'Finanzierungsantrag',           'FIN',  5, 1, 0, true,  true,  false),
  ('sepa_run',      'SEPA-Lauf',                     'SEPA', 5, 1, 0, true,  true,  false),
  ('reminder',      'Mahnung',                       'MA',   5, 1, 0, true,  true,  false),
  ('bug',           'Bug-Report',                    'BUG',  5, 1, 0, false, false, false),
  ('capa',          'CAPA',                          'CAPA', 5, 1, 0, false, false, false),
  ('audit',         'Audit-Finding',                 'AUDIT',5, 1, 0, false, false, false),
  ('pdf_security',  'PDF-Security-ID',               'SEC',  8, 1, 0, true,  true,  false)
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------
-- Format-Helper
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.format_document_number(
  _prefix      text,
  _separator   text,
  _include_year boolean,
  _padding     int,
  _value       bigint,
  _year        int
) RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN _prefix IS NULL OR length(_prefix) = 0 THEN ''
    ELSE _prefix || COALESCE(_separator,'-')
  END
  || CASE WHEN _include_year THEN _year::text || COALESCE(_separator,'-') ELSE '' END
  || lpad(_value::text, GREATEST(_padding,1), '0');
$$;

-- ---------------------------------------------------------
-- Nächste Nummer (atomar)
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.next_document_number(p_code text)
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
  SELECT * INTO r
    FROM public.number_ranges
   WHERE code = p_code
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF r.active = false THEN
    RETURN NULL;
  END IF;

  IF r.reset_yearly AND (r.last_reset_year IS NULL OR r.last_reset_year <> cur_year) THEN
    next_val := GREATEST(r.start_value, 1);
    UPDATE public.number_ranges
       SET current_value   = next_val,
           last_reset_year = cur_year,
           updated_at      = now()
     WHERE code = p_code;
  ELSE
    next_val := GREATEST(r.current_value + 1, r.start_value);
    UPDATE public.number_ranges
       SET current_value = next_val,
           updated_at    = now()
     WHERE code = p_code;
  END IF;

  RETURN public.format_document_number(r.prefix, r.separator, r.include_year, r.padding, next_val, cur_year);
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_document_number(text) TO authenticated, service_role;

-- ---------------------------------------------------------
-- Vorschau ohne Increment
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.peek_document_number(p_code text)
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
  SELECT * INTO r FROM public.number_ranges WHERE code = p_code;
  IF NOT FOUND THEN RETURN NULL; END IF;

  IF r.reset_yearly AND (r.last_reset_year IS NULL OR r.last_reset_year <> cur_year) THEN
    next_val := GREATEST(r.start_value, 1);
  ELSE
    next_val := GREATEST(r.current_value + 1, r.start_value);
  END IF;

  RETURN public.format_document_number(r.prefix, r.separator, r.include_year, r.padding, next_val, cur_year);
END;
$$;

GRANT EXECUTE ON FUNCTION public.peek_document_number(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.format_document_number(text,text,boolean,int,bigint,int) TO authenticated, service_role;
