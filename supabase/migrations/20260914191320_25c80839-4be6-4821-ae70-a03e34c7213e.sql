-- ============ 1. Felder an den Rechnungen ============
ALTER TABLE public.zoho_invoices
  ADD COLUMN IF NOT EXISTS beleg_id text,
  ADD COLUMN IF NOT EXISTS legal_invoice_number text,
  ADD COLUMN IF NOT EXISTS legal_number_assigned_at timestamptz,
  ADD COLUMN IF NOT EXISTS legal_number_locked boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS uq_zoho_invoices_legal_number
  ON public.zoho_invoices (legal_invoice_number)
  WHERE legal_invoice_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_zoho_invoices_beleg_id ON public.zoho_invoices (beleg_id);

-- ============ 2. Nummernkreise je Monat ============
CREATE TABLE IF NOT EXISTS public.invoice_number_ranges (
  period text PRIMARY KEY,                       -- 'YYYY-MM'
  start_value integer NOT NULL DEFAULT 1,
  digits integer NOT NULL DEFAULT 4,
  last_value integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',         -- active | closed
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.invoice_number_ranges TO authenticated;
GRANT ALL ON public.invoice_number_ranges TO service_role;
ALTER TABLE public.invoice_number_ranges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inr_read_auth" ON public.invoice_number_ranges
  FOR SELECT TO authenticated USING (true);

-- ============ 3. Audit-Protokoll ============
CREATE TABLE IF NOT EXISTS public.invoice_number_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid,
  beleg_id text,
  old_number text,
  new_number text,
  action text NOT NULL,                          -- assign | migrate | correct
  reason text,
  actor uuid DEFAULT auth.uid(),
  actor_email text,
  old_pdf_url text,
  new_pdf_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.invoice_number_audit TO authenticated;
GRANT ALL ON public.invoice_number_audit TO service_role;
ALTER TABLE public.invoice_number_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ina_read_auth" ON public.invoice_number_audit
  FOR SELECT TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_ina_invoice ON public.invoice_number_audit (invoice_id);

-- ============ 4. Migrationstabelle ============
CREATE TABLE IF NOT EXISTS public.invoice_number_migrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL,
  old_number text,
  new_number text NOT NULL,
  invoice_date date,
  migrated_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'erfolgreich',
  note text,
  UNIQUE (invoice_id)
);

GRANT SELECT ON public.invoice_number_migrations TO authenticated;
GRANT ALL ON public.invoice_number_migrations TO service_role;
ALTER TABLE public.invoice_number_migrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inm_read_auth" ON public.invoice_number_migrations
  FOR SELECT TO authenticated USING (true);

-- ============ 5. Transaktionssichere Nummernvergabe ============
CREATE OR REPLACE FUNCTION public.next_invoice_number(p_date date DEFAULT current_date)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period text := to_char(coalesce(p_date, current_date), 'YYYY-MM');
  v_row public.invoice_number_ranges%ROWTYPE;
  v_next integer;
BEGIN
  INSERT INTO public.invoice_number_ranges (period)
  VALUES (v_period)
  ON CONFLICT (period) DO NOTHING;

  SELECT * INTO v_row FROM public.invoice_number_ranges
  WHERE period = v_period FOR UPDATE;

  IF v_row.status = 'closed' THEN
    RAISE EXCEPTION 'Nummernkreis % ist geschlossen', v_period;
  END IF;

  v_next := GREATEST(v_row.last_value + 1, v_row.start_value);

  UPDATE public.invoice_number_ranges
  SET last_value = v_next, updated_at = now()
  WHERE period = v_period;

  RETURN v_period || '-' || lpad(v_next::text, v_row.digits, '0');
END;
$$;

-- Vergabe beim endgültigen Erstellen einer Rechnung (idempotent)
CREATE OR REPLACE FUNCTION public.assign_invoice_number(p_invoice_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv public.zoho_invoices%ROWTYPE;
  v_num text;
BEGIN
  SELECT * INTO v_inv FROM public.zoho_invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rechnung % nicht gefunden', p_invoice_id;
  END IF;

  IF v_inv.legal_invoice_number IS NOT NULL THEN
    RETURN v_inv.legal_invoice_number;
  END IF;

  v_num := public.next_invoice_number(coalesce(v_inv.invoice_date, current_date));

  UPDATE public.zoho_invoices
  SET beleg_id = coalesce(beleg_id, invoice_number),
      legal_invoice_number = v_num,
      legal_number_assigned_at = now(),
      legal_number_locked = true
  WHERE id = p_invoice_id;

  INSERT INTO public.invoice_number_audit (invoice_id, beleg_id, old_number, new_number, action, actor)
  VALUES (p_invoice_id, coalesce(v_inv.beleg_id, v_inv.invoice_number), v_inv.invoice_number, v_num, 'assign', auth.uid());

  RETURN v_num;
END;
$$;

-- ============ 6. Migration: Vorschau ============
CREATE OR REPLACE FUNCTION public.preview_invoice_renumbering(p_period text DEFAULT NULL)
RETURNS TABLE (
  invoice_id uuid,
  old_number text,
  invoice_date date,
  period text,
  planned_number text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT i.id,
           i.invoice_number,
           i.invoice_date,
           to_char(coalesce(i.invoice_date, i.created_at::date), 'YYYY-MM') AS per,
           i.created_at
    FROM public.zoho_invoices i
    WHERE i.legal_invoice_number IS NULL
  ),
  ranked AS (
    SELECT b.*,
           row_number() OVER (
             PARTITION BY b.per
             ORDER BY b.invoice_date NULLS LAST, b.created_at, b.invoice_number
           ) AS rn
    FROM base b
    WHERE p_period IS NULL OR b.per = p_period
  )
  SELECT r.id,
         r.invoice_number,
         r.invoice_date,
         r.per,
         r.per || '-' || lpad((coalesce(rg.last_value, 0) + r.rn)::text, coalesce(rg.digits, 4), '0')
  FROM ranked r
  LEFT JOIN public.invoice_number_ranges rg ON rg.period = r.per
  ORDER BY r.per, r.rn;
$$;

-- ============ 7. Migration: Ausführung ============
CREATE OR REPLACE FUNCTION public.run_invoice_renumbering(p_period text DEFAULT NULL)
RETURNS TABLE (migrated integer, periods integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_count integer := 0;
  v_periods text[] := '{}';
BEGIN
  IF NOT (public.has_role(auth.uid(), 'Super Admin') OR public.has_role(auth.uid(), 'Admin')) THEN
    RAISE EXCEPTION 'Keine Berechtigung für die Migration';
  END IF;

  FOR r IN
    SELECT i.id,
           i.invoice_number,
           i.invoice_date,
           to_char(coalesce(i.invoice_date, i.created_at::date), 'YYYY-MM') AS per
    FROM public.zoho_invoices i
    WHERE i.legal_invoice_number IS NULL
      AND (p_period IS NULL OR to_char(coalesce(i.invoice_date, i.created_at::date), 'YYYY-MM') = p_period)
    ORDER BY to_char(coalesce(i.invoice_date, i.created_at::date), 'YYYY-MM'),
             i.invoice_date NULLS LAST, i.created_at, i.invoice_number
  LOOP
    DECLARE v_num text;
    BEGIN
      v_num := public.next_invoice_number(coalesce(r.invoice_date, current_date));

      UPDATE public.zoho_invoices
      SET beleg_id = coalesce(beleg_id, invoice_number),
          legal_invoice_number = v_num,
          legal_number_assigned_at = now(),
          legal_number_locked = true
      WHERE id = r.id;

      INSERT INTO public.invoice_number_audit (invoice_id, beleg_id, old_number, new_number, action, reason, actor)
      VALUES (r.id, r.invoice_number, r.invoice_number, v_num, 'migrate', 'Migration Nummernkreis YYYY-MM-NNNN', auth.uid());

      INSERT INTO public.invoice_number_migrations (invoice_id, old_number, new_number, invoice_date, status)
      VALUES (r.id, r.invoice_number, v_num, r.invoice_date, 'erfolgreich')
      ON CONFLICT (invoice_id) DO NOTHING;

      v_count := v_count + 1;
      IF NOT (r.per = ANY (v_periods)) THEN
        v_periods := array_append(v_periods, r.per);
      END IF;
    END;
  END LOOP;

  RETURN QUERY SELECT v_count, coalesce(array_length(v_periods, 1), 0);
END;
$$;

-- ============ 8. Korrektur (nur Super Admin, mit Begründung) ============
CREATE OR REPLACE FUNCTION public.correct_invoice_number(
  p_invoice_id uuid,
  p_new_number text,
  p_reason text,
  p_old_pdf_url text DEFAULT NULL,
  p_new_pdf_url text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old text;
  v_beleg text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'Super Admin') THEN
    RAISE EXCEPTION 'Nur Super Admin darf Rechnungsnummern korrigieren';
  END IF;
  IF p_reason IS NULL OR length(btrim(p_reason)) < 5 THEN
    RAISE EXCEPTION 'Begründung erforderlich';
  END IF;
  IF p_new_number !~ '^[0-9]{4}-[0-9]{2}-[0-9]{3,6}$' THEN
    RAISE EXCEPTION 'Format muss YYYY-MM-NNNN sein';
  END IF;

  SELECT legal_invoice_number, coalesce(beleg_id, invoice_number)
    INTO v_old, v_beleg
  FROM public.zoho_invoices WHERE id = p_invoice_id FOR UPDATE;

  UPDATE public.zoho_invoices
  SET legal_invoice_number = p_new_number,
      legal_number_assigned_at = now()
  WHERE id = p_invoice_id;

  INSERT INTO public.invoice_number_audit
    (invoice_id, beleg_id, old_number, new_number, action, reason, actor, old_pdf_url, new_pdf_url)
  VALUES (p_invoice_id, v_beleg, v_old, p_new_number, 'correct', p_reason, auth.uid(), p_old_pdf_url, p_new_pdf_url);

  RETURN p_new_number;
END;
$$;

-- ============ 9. Schutz gegen stilles Überschreiben ============
CREATE OR REPLACE FUNCTION public.guard_invoice_legal_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.legal_number_locked AND OLD.legal_invoice_number IS NOT NULL
     AND NEW.legal_invoice_number IS DISTINCT FROM OLD.legal_invoice_number THEN
    RAISE EXCEPTION 'Rechnungsnummer ist gesperrt – Änderung nur über correct_invoice_number()';
  END IF;
  IF OLD.beleg_id IS NOT NULL AND NEW.beleg_id IS DISTINCT FROM OLD.beleg_id THEN
    RAISE EXCEPTION 'Beleg-ID darf nicht geändert werden';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_invoice_legal_number ON public.zoho_invoices;
CREATE TRIGGER trg_guard_invoice_legal_number
BEFORE UPDATE ON public.zoho_invoices
FOR EACH ROW EXECUTE FUNCTION public.guard_invoice_legal_number();

-- Übersicht je Monat
CREATE OR REPLACE VIEW public.invoice_number_range_overview AS
SELECT r.period,
       r.start_value,
       r.digits,
       r.last_value,
       r.status,
       count(i.id) AS invoice_count,
       min(i.legal_invoice_number) AS first_number,
       max(i.legal_invoice_number) AS last_number
FROM public.invoice_number_ranges r
LEFT JOIN public.zoho_invoices i
  ON i.legal_invoice_number LIKE r.period || '-%'
GROUP BY r.period, r.start_value, r.digits, r.last_value, r.status;

GRANT SELECT ON public.invoice_number_range_overview TO authenticated;
GRANT SELECT ON public.invoice_number_range_overview TO service_role;