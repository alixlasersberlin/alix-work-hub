
-- Phase 8: Jahresabschluss-Cockpit
CREATE TABLE public.finance_year_end_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  fiscal_year int NOT NULL,
  status text NOT NULL DEFAULT 'offen', -- offen | in_arbeit | abgeschlossen
  closing_date date,
  closed_by uuid,
  closed_at timestamptz,
  reopened_by uuid,
  reopened_at timestamptz,
  checklist jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, fiscal_year)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_year_end_runs TO authenticated;
GRANT ALL ON public.finance_year_end_runs TO service_role;

ALTER TABLE public.finance_year_end_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "yer_select" ON public.finance_year_end_runs FOR SELECT TO authenticated
  USING (public.is_admin() OR public.has_role('Finance') OR public.has_role('Geschäftsführung'));
CREATE POLICY "yer_insert" ON public.finance_year_end_runs FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.has_role('Finance'));
CREATE POLICY "yer_update" ON public.finance_year_end_runs FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.has_role('Finance'))
  WITH CHECK (public.is_admin() OR public.has_role('Finance'));
CREATE POLICY "yer_delete" ON public.finance_year_end_runs FOR DELETE TO authenticated
  USING (public.has_role('Super Admin'));

CREATE TRIGGER trg_yer_updated_at
  BEFORE UPDATE ON public.finance_year_end_runs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Lock posting in closed fiscal years (except Super Admin)
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
    (CASE WHEN TG_OP='DELETE' THEN OLD.transaction_date ELSE NEW.transaction_date END),
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

CREATE TRIGGER trg_finance_tx_year_lock
  BEFORE INSERT OR UPDATE OR DELETE ON public.finance_transactions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_year_end_lock();
