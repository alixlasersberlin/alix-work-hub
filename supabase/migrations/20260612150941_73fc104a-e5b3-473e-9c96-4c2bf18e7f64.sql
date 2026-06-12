
CREATE OR REPLACE FUNCTION public.sales_lead_after_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  due_ts timestamptz;
  due_d date;
BEGIN
  due_d := (current_date + 1);
  IF extract(dow from due_d) = 6 THEN due_d := due_d + 2;
  ELSIF extract(dow from due_d) = 0 THEN due_d := due_d + 1;
  END IF;
  due_ts := (due_d::timestamp + interval '10 hours') AT TIME ZONE 'Europe/Berlin';

  IF COALESCE(NEW.lead_status, '') IN ('', 'Neu', 'Importiert - Angebot offen') THEN
    BEGIN
      INSERT INTO public.sales_followups (lead_id, type, title, due_at, description, status)
      VALUES (NEW.id, 'Rückruf', 'Kontaktaufnahme erforderlich', due_ts,
              'Automatisch erzeugt nach Lead-Import', 'offen');
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;
  RETURN NEW;
END;
$$;
