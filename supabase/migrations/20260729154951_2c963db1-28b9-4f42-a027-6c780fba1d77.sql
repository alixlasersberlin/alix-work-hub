
ALTER TABLE public.finance_budgets DROP CONSTRAINT IF EXISTS finance_budgets_tenant_id_fiscal_year_month_category_key;
CREATE UNIQUE INDEX IF NOT EXISTS finance_budgets_uniq_region
  ON public.finance_budgets (tenant_id, fiscal_year, month, category, accounting_region);

ALTER TABLE public.finance_forecasts DROP CONSTRAINT IF EXISTS finance_forecasts_tenant_id_period_date_category_scenario_key;
CREATE UNIQUE INDEX IF NOT EXISTS finance_forecasts_uniq_region
  ON public.finance_forecasts (tenant_id, period_date, category, scenario, accounting_region);
