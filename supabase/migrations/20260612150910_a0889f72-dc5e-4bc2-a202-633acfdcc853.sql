
-- 1. Neue Spalten auf sales_leads
ALTER TABLE public.sales_leads
  ADD COLUMN IF NOT EXISTS lead_number text UNIQUE,
  ADD COLUMN IF NOT EXISTS device_category text,
  ADD COLUMN IF NOT EXISTS additional_services jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS customer_goal text,
  ADD COLUMN IF NOT EXISTS implementation_period text;

-- 2. Sequence für Leadnummern
CREATE SEQUENCE IF NOT EXISTS public.sales_lead_seq START 1;

-- 3. Trigger-Funktion: Leadnummer LEAD-YYYY-000001
CREATE OR REPLACE FUNCTION public.assign_sales_lead_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  next_seq bigint;
BEGIN
  IF NEW.lead_number IS NULL OR length(trim(NEW.lead_number)) = 0 THEN
    next_seq := nextval('public.sales_lead_seq');
    NEW.lead_number := 'LEAD-' || to_char(COALESCE(NEW.created_at, now()), 'YYYY') || '-' || lpad(next_seq::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_sales_lead_number ON public.sales_leads;
CREATE TRIGGER trg_assign_sales_lead_number
  BEFORE INSERT ON public.sales_leads
  FOR EACH ROW EXECUTE FUNCTION public.assign_sales_lead_number();

-- 4. Backfill bestehender Zeilen in Reihenfolge created_at
DO $$
DECLARE
  r record;
  seq bigint;
BEGIN
  FOR r IN SELECT id, created_at FROM public.sales_leads WHERE lead_number IS NULL ORDER BY created_at ASC LOOP
    seq := nextval('public.sales_lead_seq');
    UPDATE public.sales_leads
       SET lead_number = 'LEAD-' || to_char(COALESCE(r.created_at, now()), 'YYYY') || '-' || lpad(seq::text, 6, '0')
     WHERE id = r.id;
  END LOOP;
END $$;

-- 5. Auto-Followup nach Insert: "Kontaktaufnahme erforderlich" +1 Werktag
CREATE OR REPLACE FUNCTION public.sales_lead_after_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  due date;
BEGIN
  -- nächster Werktag
  due := (current_date + 1);
  IF extract(dow from due) = 6 THEN due := due + 2; -- Samstag -> Montag
  ELSIF extract(dow from due) = 0 THEN due := due + 1; -- Sonntag -> Montag
  END IF;

  IF COALESCE(NEW.lead_status, '') IN ('', 'Neu', 'Importiert - Angebot offen') THEN
    BEGIN
      INSERT INTO public.sales_followups (lead_id, type, title, due_date, note, status)
      VALUES (NEW.id, 'Rückruf', 'Kontaktaufnahme erforderlich', due,
              'Automatisch erzeugt nach Lead-Import', 'offen');
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sales_lead_after_insert ON public.sales_leads;
CREATE TRIGGER trg_sales_lead_after_insert
  AFTER INSERT ON public.sales_leads
  FOR EACH ROW EXECUTE FUNCTION public.sales_lead_after_insert();
