
CREATE OR REPLACE FUNCTION public.enforce_year_end_lock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dt date;
  v_locked boolean;
BEGIN
  IF public.has_role('Super Admin') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_dt := COALESCE(
    (CASE WHEN TG_OP='DELETE' THEN OLD.booking_date ELSE NEW.booking_date END),
    (CASE WHEN TG_OP='DELETE' THEN OLD.created_at::date ELSE NEW.created_at::date END)
  );

  IF v_dt IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.finance_year_end_runs
     WHERE status = 'abgeschlossen'
       AND fiscal_year = EXTRACT(YEAR FROM v_dt)::int
       AND (closing_date IS NULL OR v_dt <= closing_date)
  ) INTO v_locked;

  IF v_locked THEN
    RAISE EXCEPTION 'Geschäftsjahr % ist abgeschlossen. Buchung gesperrt.', EXTRACT(YEAR FROM v_dt)::int;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;
