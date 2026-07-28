ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS case_number text;
CREATE INDEX IF NOT EXISTS idx_tickets_case_number ON public.tickets(case_number);

CREATE OR REPLACE FUNCTION public.tickets_assign_case_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing text;
  v_new text;
BEGIN
  IF NEW.case_number IS NOT NULL AND length(trim(NEW.case_number)) > 0 THEN
    RETURN NEW;
  END IF;

  SELECT case_number INTO v_existing
  FROM public.tickets
  WHERE case_number IS NOT NULL
    AND created_at > now() - interval '60 days'
    AND NEW.customer_email IS NOT NULL
    AND lower(customer_email) = lower(NEW.customer_email)
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    NEW.case_number := v_existing;
    RETURN NEW;
  END IF;

  BEGIN
    SELECT public.next_case_number() INTO v_new;
  EXCEPTION WHEN OTHERS THEN
    v_new := NULL;
  END;

  IF v_new IS NULL OR length(v_new) = 0 THEN
    v_new := to_char(now(), 'YYYY') || '-' || lpad((floor(random()*99999))::text, 5, '0');
  END IF;

  NEW.case_number := v_new;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tickets_assign_case_number ON public.tickets;
CREATE TRIGGER trg_tickets_assign_case_number
BEFORE INSERT ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.tickets_assign_case_number();

UPDATE public.tickets t
SET case_number = COALESCE(
  (SELECT t2.case_number FROM public.tickets t2
    WHERE t2.case_number IS NOT NULL
      AND t.customer_email IS NOT NULL
      AND lower(t2.customer_email) = lower(t.customer_email)
    ORDER BY t2.created_at DESC LIMIT 1),
  to_char(COALESCE(t.created_at, now()), 'YYYY') || '-' || lpad((floor(random()*99999))::text, 5, '0')
)
WHERE t.case_number IS NULL;