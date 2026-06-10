
CREATE TABLE public.finance_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  fiscal_year int NOT NULL,
  month int NOT NULL CHECK (month BETWEEN 1 AND 12),
  category text NOT NULL,
  planned_amount numeric(14,2) NOT NULL DEFAULT 0,
  notes text,
  created_by uuid DEFAULT auth.uid(),
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, fiscal_year, month, category)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_budgets TO authenticated;
GRANT ALL ON public.finance_budgets TO service_role;
ALTER TABLE public.finance_budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fb_sel" ON public.finance_budgets FOR SELECT TO authenticated
  USING (public.is_admin() OR public.has_role('Finance') OR public.has_role('Geschäftsführung'));
CREATE POLICY "fb_ins" ON public.finance_budgets FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.has_role('Finance'));
CREATE POLICY "fb_upd" ON public.finance_budgets FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.has_role('Finance'))
  WITH CHECK (public.is_admin() OR public.has_role('Finance'));
CREATE POLICY "fb_del" ON public.finance_budgets FOR DELETE TO authenticated
  USING (public.has_role('Super Admin'));
CREATE TRIGGER trg_fb_updated_at BEFORE UPDATE ON public.finance_budgets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.finance_forecasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  period_date date NOT NULL,
  category text NOT NULL,
  scenario text NOT NULL DEFAULT 'base' CHECK (scenario IN ('base','best','worst')),
  forecast_amount numeric(14,2) NOT NULL DEFAULT 0,
  notes text,
  created_by uuid DEFAULT auth.uid(),
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, period_date, category, scenario)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_forecasts TO authenticated;
GRANT ALL ON public.finance_forecasts TO service_role;
ALTER TABLE public.finance_forecasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ff_sel" ON public.finance_forecasts FOR SELECT TO authenticated
  USING (public.is_admin() OR public.has_role('Finance') OR public.has_role('Geschäftsführung'));
CREATE POLICY "ff_ins" ON public.finance_forecasts FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.has_role('Finance'));
CREATE POLICY "ff_upd" ON public.finance_forecasts FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.has_role('Finance'))
  WITH CHECK (public.is_admin() OR public.has_role('Finance'));
CREATE POLICY "ff_del" ON public.finance_forecasts FOR DELETE TO authenticated
  USING (public.has_role('Super Admin'));
CREATE TRIGGER trg_ff_updated_at BEFORE UPDATE ON public.finance_forecasts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
