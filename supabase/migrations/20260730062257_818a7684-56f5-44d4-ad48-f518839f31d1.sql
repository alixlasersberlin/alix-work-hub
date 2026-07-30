ALTER TABLE public.finance_periods
  ADD COLUMN IF NOT EXISTS reopened_at timestamptz,
  ADD COLUMN IF NOT EXISTS reopened_by uuid;

CREATE UNIQUE INDEX IF NOT EXISTS uq_finance_periods_region_year_month
  ON public.finance_periods (accounting_region, fiscal_year, period_month);

CREATE OR REPLACE FUNCTION public.enforce_period_lock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_dt date;
  v_region accounting_region;
  v_locked boolean;
BEGIN
  IF public.has_role('Super Admin') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_dt := OLD.booking_date;
    v_region := OLD.accounting_region;
  ELSE
    v_dt := NEW.booking_date;
    v_region := NEW.accounting_region;
  END IF;

  IF v_dt IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
  v_region := COALESCE(v_region, 'EU');

  SELECT EXISTS(
    SELECT 1 FROM public.finance_periods p
     WHERE p.accounting_region = v_region
       AND p.fiscal_year = EXTRACT(YEAR FROM v_dt)::int
       AND p.period_month = EXTRACT(MONTH FROM v_dt)::int
       AND p.status IN ('geschlossen','closed','abgeschlossen')
  ) INTO v_locked;

  IF v_locked THEN
    RAISE EXCEPTION 'Periode %-% (%) ist abgeschlossen. Buchung gesperrt.',
      EXTRACT(YEAR FROM v_dt)::int, LPAD(EXTRACT(MONTH FROM v_dt)::text, 2, '0'), v_region;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

DROP TRIGGER IF EXISTS trg_period_lock ON public.finance_transactions;
CREATE TRIGGER trg_period_lock BEFORE INSERT OR UPDATE OR DELETE ON public.finance_transactions
FOR EACH ROW EXECUTE FUNCTION public.enforce_period_lock();

DROP TRIGGER IF EXISTS trg_period_lock ON public.finance_journal;
CREATE TRIGGER trg_period_lock BEFORE INSERT OR UPDATE OR DELETE ON public.finance_journal
FOR EACH ROW EXECUTE FUNCTION public.enforce_period_lock();

DROP TRIGGER IF EXISTS trg_period_lock ON public.finance_cashbook;
CREATE TRIGGER trg_period_lock BEFORE INSERT OR UPDATE OR DELETE ON public.finance_cashbook
FOR EACH ROW EXECUTE FUNCTION public.enforce_period_lock();

DROP TRIGGER IF EXISTS trg_period_lock ON public.finance_bank_postings;
CREATE TRIGGER trg_period_lock BEFORE INSERT OR UPDATE OR DELETE ON public.finance_bank_postings
FOR EACH ROW EXECUTE FUNCTION public.enforce_period_lock();