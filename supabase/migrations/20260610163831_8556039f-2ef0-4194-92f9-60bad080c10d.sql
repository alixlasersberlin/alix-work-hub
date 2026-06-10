
-- 1) Additive columns on finance_transactions
ALTER TABLE public.finance_transactions
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id),
  ADD COLUMN IF NOT EXISTS counterparty_tenant_id uuid REFERENCES public.tenants(id),
  ADD COLUMN IF NOT EXISTS is_intercompany boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_finance_tx_tenant ON public.finance_transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_finance_tx_ic ON public.finance_transactions(is_intercompany) WHERE is_intercompany;

-- 2) finance_intercompany_relations
CREATE TABLE IF NOT EXISTS public.finance_intercompany_relations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  target_tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  label text,
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_finance_ic_rel UNIQUE (source_tenant_id, target_tenant_id),
  CONSTRAINT chk_finance_ic_distinct CHECK (source_tenant_id <> target_tenant_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_intercompany_relations TO authenticated;
GRANT ALL ON public.finance_intercompany_relations TO service_role;
ALTER TABLE public.finance_intercompany_relations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ic_rel_select" ON public.finance_intercompany_relations FOR SELECT TO authenticated
  USING (public.can_access_finance() OR public.has_role('Geschäftsführung'));
CREATE POLICY "ic_rel_insert" ON public.finance_intercompany_relations FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.has_role('Geschäftsführung'));
CREATE POLICY "ic_rel_update" ON public.finance_intercompany_relations FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.has_role('Geschäftsführung'))
  WITH CHECK (public.is_admin() OR public.has_role('Geschäftsführung'));
CREATE POLICY "ic_rel_delete" ON public.finance_intercompany_relations FOR DELETE TO authenticated
  USING (public.has_role('Super Admin'));

-- 3) finance_intercompany_matches
CREATE TABLE IF NOT EXISTS public.finance_intercompany_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_tx_id uuid NOT NULL REFERENCES public.finance_transactions(id) ON DELETE CASCADE,
  target_tx_id uuid NOT NULL REFERENCES public.finance_transactions(id) ON DELETE CASCADE,
  source_tenant_id uuid REFERENCES public.tenants(id),
  target_tenant_id uuid REFERENCES public.tenants(id),
  period_month date,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  status text NOT NULL DEFAULT 'matched',
  notes text,
  matched_by uuid,
  matched_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_finance_ic_match UNIQUE (source_tx_id, target_tx_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_intercompany_matches TO authenticated;
GRANT ALL ON public.finance_intercompany_matches TO service_role;
ALTER TABLE public.finance_intercompany_matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ic_match_select" ON public.finance_intercompany_matches FOR SELECT TO authenticated
  USING (public.can_access_finance() OR public.has_role('Geschäftsführung'));
CREATE POLICY "ic_match_insert" ON public.finance_intercompany_matches FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.has_role('Geschäftsführung') OR public.can_access_finance());
CREATE POLICY "ic_match_update" ON public.finance_intercompany_matches FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.has_role('Geschäftsführung'))
  WITH CHECK (public.is_admin() OR public.has_role('Geschäftsführung'));
CREATE POLICY "ic_match_delete" ON public.finance_intercompany_matches FOR DELETE TO authenticated
  USING (public.has_role('Super Admin'));

-- 4) finance_fx_rates
CREATE TABLE IF NOT EXISTS public.finance_fx_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  currency text NOT NULL,
  rate_date date NOT NULL,
  rate_to_eur numeric NOT NULL,
  source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_finance_fx UNIQUE (currency, rate_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_fx_rates TO authenticated;
GRANT ALL ON public.finance_fx_rates TO service_role;
ALTER TABLE public.finance_fx_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fx_select" ON public.finance_fx_rates FOR SELECT TO authenticated
  USING (public.can_access_finance() OR public.has_role('Geschäftsführung'));
CREATE POLICY "fx_insert" ON public.finance_fx_rates FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.has_role('Geschäftsführung') OR public.can_access_finance());
CREATE POLICY "fx_update" ON public.finance_fx_rates FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.has_role('Geschäftsführung'))
  WITH CHECK (public.is_admin() OR public.has_role('Geschäftsführung'));
CREATE POLICY "fx_delete" ON public.finance_fx_rates FOR DELETE TO authenticated
  USING (public.has_role('Super Admin'));

-- 5) finance_consolidation_runs
CREATE TABLE IF NOT EXISTS public.finance_consolidation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_month date NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  prepared_by uuid,
  notes text,
  totals jsonb NOT NULL DEFAULT '{}'::jsonb,
  tenant_count int NOT NULL DEFAULT 0,
  gross_total numeric NOT NULL DEFAULT 0,
  eliminated_total numeric NOT NULL DEFAULT 0,
  consolidated_total numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_consolidation_runs TO authenticated;
GRANT ALL ON public.finance_consolidation_runs TO service_role;
ALTER TABLE public.finance_consolidation_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cons_run_select" ON public.finance_consolidation_runs FOR SELECT TO authenticated
  USING (public.can_access_finance() OR public.has_role('Geschäftsführung'));
CREATE POLICY "cons_run_insert" ON public.finance_consolidation_runs FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.has_role('Geschäftsführung') OR public.can_access_finance());
CREATE POLICY "cons_run_update" ON public.finance_consolidation_runs FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.has_role('Geschäftsführung'))
  WITH CHECK (public.is_admin() OR public.has_role('Geschäftsführung'));
CREATE POLICY "cons_run_delete" ON public.finance_consolidation_runs FOR DELETE TO authenticated
  USING (public.has_role('Super Admin'));

-- 6) finance_consolidation_items
CREATE TABLE IF NOT EXISTS public.finance_consolidation_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.finance_consolidation_runs(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES public.tenants(id),
  account_code text,
  account_label text,
  transaction_type text,
  currency text NOT NULL DEFAULT 'EUR',
  gross_amount numeric NOT NULL DEFAULT 0,
  eliminated_amount numeric NOT NULL DEFAULT 0,
  consolidated_amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cons_items_run ON public.finance_consolidation_items(run_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_consolidation_items TO authenticated;
GRANT ALL ON public.finance_consolidation_items TO service_role;
ALTER TABLE public.finance_consolidation_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cons_items_select" ON public.finance_consolidation_items FOR SELECT TO authenticated
  USING (public.can_access_finance() OR public.has_role('Geschäftsführung'));
CREATE POLICY "cons_items_insert" ON public.finance_consolidation_items FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.has_role('Geschäftsführung') OR public.can_access_finance());
CREATE POLICY "cons_items_update" ON public.finance_consolidation_items FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.has_role('Geschäftsführung'))
  WITH CHECK (public.is_admin() OR public.has_role('Geschäftsführung'));
CREATE POLICY "cons_items_delete" ON public.finance_consolidation_items FOR DELETE TO authenticated
  USING (public.has_role('Super Admin'));

-- 7) updated_at trigger
DROP TRIGGER IF EXISTS trg_ic_rel_updated_at ON public.finance_intercompany_relations;
CREATE TRIGGER trg_ic_rel_updated_at BEFORE UPDATE ON public.finance_intercompany_relations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_cons_run_updated_at ON public.finance_consolidation_runs;
CREATE TRIGGER trg_cons_run_updated_at BEFORE UPDATE ON public.finance_consolidation_runs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
