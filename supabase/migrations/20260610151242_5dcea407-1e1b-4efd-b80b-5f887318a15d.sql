
-- ============= Sequences =============
CREATE SEQUENCE IF NOT EXISTS public.finance_asset_seq START 1;

-- ============= finance_assets =============
CREATE TABLE public.finance_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_number text UNIQUE,
  name text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'Sonstiges'
    CHECK (category IN ('Fuhrpark','IT','Werkstattausstattung','Geräte','Software','Büroausstattung','Sonstiges')),
  tenant_id uuid REFERENCES public.tenants(id),
  acquisition_date date NOT NULL,
  acquisition_value numeric(14,2) NOT NULL CHECK (acquisition_value >= 0),
  useful_life_months int NOT NULL DEFAULT 36 CHECK (useful_life_months > 0),
  depreciation_method text NOT NULL DEFAULT 'linear'
    CHECK (depreciation_method IN ('linear','gwg_sofort','gwg_pool','degressiv')),
  degressive_rate numeric(5,2),
  book_value numeric(14,2) NOT NULL DEFAULT 0,
  accumulated_depreciation numeric(14,2) NOT NULL DEFAULT 0,
  location text,
  supplier_id uuid REFERENCES public.suppliers(id),
  supplier_name text,
  incoming_invoice_id uuid REFERENCES public.finance_incoming_invoices(id) ON DELETE SET NULL,
  document_id uuid REFERENCES public.finance_documents(id) ON DELETE SET NULL,
  datev_account text,
  status text NOT NULL DEFAULT 'aktiv'
    CHECK (status IN ('aktiv','abgegangen','verkauft','verschrottet')),
  disposal_date date,
  disposal_reason text,
  disposal_value numeric(14,2),
  notes text,
  meta jsonb DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_fa_tenant ON public.finance_assets(tenant_id);
CREATE INDEX idx_fa_status ON public.finance_assets(status);
CREATE INDEX idx_fa_category ON public.finance_assets(category);
CREATE INDEX idx_fa_acq_date ON public.finance_assets(acquisition_date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_assets TO authenticated;
GRANT ALL ON public.finance_assets TO service_role;

ALTER TABLE public.finance_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fa_select" ON public.finance_assets FOR SELECT TO authenticated
  USING (public.is_admin() OR public.has_role('Finance') OR public.has_role('Geschäftsführung'));
CREATE POLICY "fa_insert" ON public.finance_assets FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.has_role('Finance'));
CREATE POLICY "fa_update" ON public.finance_assets FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.has_role('Finance'))
  WITH CHECK (public.is_admin() OR public.has_role('Finance'));
CREATE POLICY "fa_delete" ON public.finance_assets FOR DELETE TO authenticated
  USING (public.has_role('Super Admin'));

-- Auto-assign inventory number
CREATE OR REPLACE FUNCTION public.assign_finance_asset_number()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.inventory_number IS NULL OR length(trim(NEW.inventory_number)) = 0 THEN
    NEW.inventory_number := 'ANL-' || to_char(now(),'YYYY') || '-' ||
      LPAD(nextval('public.finance_asset_seq')::text, 5, '0');
  END IF;
  -- Initial book value defaults to acquisition_value for linear/degressive
  IF NEW.book_value = 0 AND NEW.depreciation_method <> 'gwg_sofort' THEN
    NEW.book_value := NEW.acquisition_value;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_fa_assign_number
  BEFORE INSERT ON public.finance_assets
  FOR EACH ROW EXECUTE FUNCTION public.assign_finance_asset_number();

CREATE TRIGGER trg_fa_updated_at
  BEFORE UPDATE ON public.finance_assets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============= finance_asset_depreciations =============
CREATE TABLE public.finance_asset_depreciations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.finance_assets(id) ON DELETE CASCADE,
  period date NOT NULL,
  amount numeric(14,2) NOT NULL CHECK (amount >= 0),
  book_value_after numeric(14,2) NOT NULL DEFAULT 0,
  method text NOT NULL,
  datev_account text,
  posting_text text,
  finance_transaction_id uuid REFERENCES public.finance_transactions(id) ON DELETE SET NULL,
  is_posted boolean NOT NULL DEFAULT false,
  posted_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (asset_id, period)
);

CREATE INDEX idx_fad_asset ON public.finance_asset_depreciations(asset_id);
CREATE INDEX idx_fad_period ON public.finance_asset_depreciations(period);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_asset_depreciations TO authenticated;
GRANT ALL ON public.finance_asset_depreciations TO service_role;

ALTER TABLE public.finance_asset_depreciations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fad_select" ON public.finance_asset_depreciations FOR SELECT TO authenticated
  USING (public.is_admin() OR public.has_role('Finance') OR public.has_role('Geschäftsführung'));
CREATE POLICY "fad_insert" ON public.finance_asset_depreciations FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.has_role('Finance'));
CREATE POLICY "fad_update" ON public.finance_asset_depreciations FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.has_role('Finance'))
  WITH CHECK (public.is_admin() OR public.has_role('Finance'));
CREATE POLICY "fad_delete" ON public.finance_asset_depreciations FOR DELETE TO authenticated
  USING (public.has_role('Super Admin'));

-- ============= finance_cashflow_plans =============
CREATE TABLE public.finance_cashflow_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  tenant_id uuid REFERENCES public.tenants(id),
  period_start date NOT NULL,
  period_end date NOT NULL,
  opening_balance numeric(14,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'entwurf'
    CHECK (status IN ('entwurf','aktiv','archiviert')),
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_fcp_tenant ON public.finance_cashflow_plans(tenant_id);
CREATE INDEX idx_fcp_status ON public.finance_cashflow_plans(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_cashflow_plans TO authenticated;
GRANT ALL ON public.finance_cashflow_plans TO service_role;

ALTER TABLE public.finance_cashflow_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fcp_select" ON public.finance_cashflow_plans FOR SELECT TO authenticated
  USING (public.is_admin() OR public.has_role('Finance') OR public.has_role('Geschäftsführung'));
CREATE POLICY "fcp_insert" ON public.finance_cashflow_plans FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.has_role('Finance'));
CREATE POLICY "fcp_update" ON public.finance_cashflow_plans FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.has_role('Finance'))
  WITH CHECK (public.is_admin() OR public.has_role('Finance'));
CREATE POLICY "fcp_delete" ON public.finance_cashflow_plans FOR DELETE TO authenticated
  USING (public.has_role('Super Admin'));

CREATE TRIGGER trg_fcp_updated_at
  BEFORE UPDATE ON public.finance_cashflow_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============= finance_cashflow_items =============
CREATE TABLE public.finance_cashflow_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.finance_cashflow_plans(id) ON DELETE CASCADE,
  month date NOT NULL,
  category text NOT NULL,
  flow_type text NOT NULL CHECK (flow_type IN ('einnahme','ausgabe')),
  planned_amount numeric(14,2) NOT NULL DEFAULT 0,
  actual_amount numeric(14,2) NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'manuell' CHECK (source IN ('manuell','auto_zoho','auto_recurring','auto_sepa','auto_incoming','auto_afa','auto_bank')),
  origin_ref text,
  description text,
  meta jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_fci_plan ON public.finance_cashflow_items(plan_id);
CREATE INDEX idx_fci_month ON public.finance_cashflow_items(month);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_cashflow_items TO authenticated;
GRANT ALL ON public.finance_cashflow_items TO service_role;

ALTER TABLE public.finance_cashflow_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fci_select" ON public.finance_cashflow_items FOR SELECT TO authenticated
  USING (public.is_admin() OR public.has_role('Finance') OR public.has_role('Geschäftsführung'));
CREATE POLICY "fci_insert" ON public.finance_cashflow_items FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.has_role('Finance'));
CREATE POLICY "fci_update" ON public.finance_cashflow_items FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.has_role('Finance'))
  WITH CHECK (public.is_admin() OR public.has_role('Finance'));
CREATE POLICY "fci_delete" ON public.finance_cashflow_items FOR DELETE TO authenticated
  USING (public.has_role('Super Admin'));

CREATE TRIGGER trg_fci_updated_at
  BEFORE UPDATE ON public.finance_cashflow_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
