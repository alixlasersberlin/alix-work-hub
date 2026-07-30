-- ============ Lohnarten ============
CREATE TABLE public.finance_wage_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  accounting_region public.accounting_region NOT NULL DEFAULT 'EU',
  code text NOT NULL,
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'earning', -- earning | deduction | employer_contribution
  percentage numeric(8,4),
  fixed_amount numeric(14,2),
  account_number text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_fin_wage_types_region_code ON public.finance_wage_types (accounting_region, code);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_wage_types TO authenticated;
GRANT ALL ON public.finance_wage_types TO service_role;
ALTER TABLE public.finance_wage_types ENABLE ROW LEVEL SECURITY;

-- ============ Sozialversicherungssätze ============
CREATE TABLE public.finance_social_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  accounting_region public.accounting_region NOT NULL DEFAULT 'CH',
  code text NOT NULL,
  name text NOT NULL,
  employee_rate numeric(8,4) NOT NULL DEFAULT 0,
  employer_rate numeric(8,4) NOT NULL DEFAULT 0,
  base_min numeric(14,2),
  base_max numeric(14,2),
  valid_from date NOT NULL DEFAULT date_trunc('year', now())::date,
  valid_to date,
  account_number text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_fin_social_rates_region ON public.finance_social_rates (accounting_region, valid_from DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_social_rates TO authenticated;
GRANT ALL ON public.finance_social_rates TO service_role;
ALTER TABLE public.finance_social_rates ENABLE ROW LEVEL SECURITY;

-- ============ Lohnläufe ============
CREATE TABLE public.finance_payroll_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  accounting_region public.accounting_region NOT NULL DEFAULT 'EU',
  period_year integer NOT NULL,
  period_month integer NOT NULL,
  label text,
  status text NOT NULL DEFAULT 'entwurf', -- entwurf | freigegeben | verbucht
  currency text NOT NULL DEFAULT 'EUR',
  total_gross numeric(14,2) NOT NULL DEFAULT 0,
  total_deductions numeric(14,2) NOT NULL DEFAULT 0,
  total_net numeric(14,2) NOT NULL DEFAULT 0,
  total_employer_cost numeric(14,2) NOT NULL DEFAULT 0,
  employee_count integer NOT NULL DEFAULT 0,
  posted_at timestamptz,
  posted_by uuid,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_fin_payroll_runs_period ON public.finance_payroll_runs (accounting_region, period_year, period_month);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_payroll_runs TO authenticated;
GRANT ALL ON public.finance_payroll_runs TO service_role;
ALTER TABLE public.finance_payroll_runs ENABLE ROW LEVEL SECURITY;

-- ============ Lohnjournal-Zeilen ============
CREATE TABLE public.finance_payroll_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.finance_payroll_runs(id) ON DELETE CASCADE,
  employee_name text NOT NULL,
  employee_number text,
  wage_type_code text,
  wage_type_name text,
  kind text NOT NULL DEFAULT 'earning',
  amount numeric(14,2) NOT NULL DEFAULT 0,
  account_number text,
  cost_center text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_fin_payroll_lines_run ON public.finance_payroll_lines (run_id);
CREATE INDEX idx_fin_payroll_lines_emp ON public.finance_payroll_lines (run_id, employee_name);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_payroll_lines TO authenticated;
GRANT ALL ON public.finance_payroll_lines TO service_role;
ALTER TABLE public.finance_payroll_lines ENABLE ROW LEVEL SECURITY;

-- ============ RLS ============
CREATE OR REPLACE FUNCTION public.can_manage_payroll()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role('Super Admin')
      OR public.has_role('Admin')
      OR public.has_role('Geschäftsführung')
      OR public.has_role('Finance')
      OR public.has_role('Buchhaltung Admin')
      OR public.has_role('Buchhaltung EU')
      OR public.has_role('Buchhaltung CH')
$$;

CREATE POLICY "payroll_wage_types_read" ON public.finance_wage_types FOR SELECT TO authenticated USING (public.can_manage_payroll());
CREATE POLICY "payroll_wage_types_write" ON public.finance_wage_types FOR INSERT TO authenticated WITH CHECK (public.can_manage_payroll());
CREATE POLICY "payroll_wage_types_update" ON public.finance_wage_types FOR UPDATE TO authenticated USING (public.can_manage_payroll()) WITH CHECK (public.can_manage_payroll());
CREATE POLICY "payroll_wage_types_delete" ON public.finance_wage_types FOR DELETE TO authenticated USING (public.has_role('Super Admin'));

CREATE POLICY "payroll_social_rates_read" ON public.finance_social_rates FOR SELECT TO authenticated USING (public.can_manage_payroll());
CREATE POLICY "payroll_social_rates_write" ON public.finance_social_rates FOR INSERT TO authenticated WITH CHECK (public.can_manage_payroll());
CREATE POLICY "payroll_social_rates_update" ON public.finance_social_rates FOR UPDATE TO authenticated USING (public.can_manage_payroll()) WITH CHECK (public.can_manage_payroll());
CREATE POLICY "payroll_social_rates_delete" ON public.finance_social_rates FOR DELETE TO authenticated USING (public.has_role('Super Admin'));

CREATE POLICY "payroll_runs_read" ON public.finance_payroll_runs FOR SELECT TO authenticated USING (public.can_manage_payroll());
CREATE POLICY "payroll_runs_write" ON public.finance_payroll_runs FOR INSERT TO authenticated WITH CHECK (public.can_manage_payroll());
CREATE POLICY "payroll_runs_update" ON public.finance_payroll_runs FOR UPDATE TO authenticated USING (public.can_manage_payroll()) WITH CHECK (public.can_manage_payroll());
CREATE POLICY "payroll_runs_delete" ON public.finance_payroll_runs FOR DELETE TO authenticated USING (public.has_role('Super Admin'));

CREATE POLICY "payroll_lines_read" ON public.finance_payroll_lines FOR SELECT TO authenticated USING (public.can_manage_payroll());
CREATE POLICY "payroll_lines_write" ON public.finance_payroll_lines FOR INSERT TO authenticated WITH CHECK (public.can_manage_payroll());
CREATE POLICY "payroll_lines_update" ON public.finance_payroll_lines FOR UPDATE TO authenticated USING (public.can_manage_payroll()) WITH CHECK (public.can_manage_payroll());
CREATE POLICY "payroll_lines_delete" ON public.finance_payroll_lines FOR DELETE TO authenticated USING (public.has_role('Super Admin'));

-- ============ updated_at Trigger ============
CREATE TRIGGER trg_fin_wage_types_updated BEFORE UPDATE ON public.finance_wage_types FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_fin_social_rates_updated BEFORE UPDATE ON public.finance_social_rates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_fin_payroll_runs_updated BEFORE UPDATE ON public.finance_payroll_runs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_fin_payroll_lines_updated BEFORE UPDATE ON public.finance_payroll_lines FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ Summen-Aggregation ============
CREATE OR REPLACE FUNCTION public.finance_payroll_recalc()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_run uuid;
BEGIN
  v_run := COALESCE(NEW.run_id, OLD.run_id);
  UPDATE public.finance_payroll_runs r SET
    total_gross = COALESCE((SELECT SUM(amount) FROM public.finance_payroll_lines WHERE run_id = v_run AND kind = 'earning'), 0),
    total_deductions = COALESCE((SELECT SUM(amount) FROM public.finance_payroll_lines WHERE run_id = v_run AND kind = 'deduction'), 0),
    total_employer_cost = COALESCE((SELECT SUM(amount) FROM public.finance_payroll_lines WHERE run_id = v_run AND kind = 'employer_contribution'), 0),
    total_net = COALESCE((SELECT SUM(amount) FROM public.finance_payroll_lines WHERE run_id = v_run AND kind = 'earning'), 0)
              - COALESCE((SELECT SUM(amount) FROM public.finance_payroll_lines WHERE run_id = v_run AND kind = 'deduction'), 0),
    employee_count = COALESCE((SELECT COUNT(DISTINCT employee_name) FROM public.finance_payroll_lines WHERE run_id = v_run), 0)
  WHERE r.id = v_run;
  RETURN NULL;
END $$;

CREATE TRIGGER trg_fin_payroll_recalc
AFTER INSERT OR UPDATE OR DELETE ON public.finance_payroll_lines
FOR EACH ROW EXECUTE FUNCTION public.finance_payroll_recalc();

-- ============ Standard-Sätze ============
INSERT INTO public.finance_social_rates (accounting_region, code, name, employee_rate, employer_rate, account_number) VALUES
  ('CH','AHV','AHV/IV/EO',5.3000,5.3000,'5700'),
  ('CH','ALV','Arbeitslosenversicherung',1.1000,1.1000,'5710'),
  ('CH','BVG','Berufliche Vorsorge (BVG)',3.5000,3.5000,'5720'),
  ('CH','UVG','Unfallversicherung (UVG)',0.0000,1.0000,'5730'),
  ('CH','KTG','Krankentaggeld (KTG)',0.8000,0.8000,'5740'),
  ('EU','RV','Rentenversicherung',9.3000,9.3000,'6110'),
  ('EU','KV','Krankenversicherung',8.1500,8.1500,'6120'),
  ('EU','PV','Pflegeversicherung',1.8000,1.8000,'6130'),
  ('EU','AV','Arbeitslosenversicherung',1.3000,1.3000,'6140');

INSERT INTO public.finance_wage_types (accounting_region, code, name, kind, account_number, sort_order) VALUES
  ('CH','1000','Monatslohn','earning','5000',10),
  ('CH','1100','Zulagen','earning','5010',20),
  ('CH','5000','AHV/IV/EO Abzug','deduction','5700',30),
  ('CH','5010','ALV Abzug','deduction','5710',40),
  ('CH','5020','BVG Abzug','deduction','5720',50),
  ('CH','6000','AG-Beitrag Sozialversicherung','employer_contribution','5790',60),
  ('EU','1000','Bruttogehalt','earning','6000',10),
  ('EU','1100','Zuschläge','earning','6010',20),
  ('EU','5000','Lohnsteuer','deduction','3730',30),
  ('EU','5010','SV-Abzug Arbeitnehmer','deduction','3740',40),
  ('EU','6000','AG-Anteil Sozialversicherung','employer_contribution','6110',50);