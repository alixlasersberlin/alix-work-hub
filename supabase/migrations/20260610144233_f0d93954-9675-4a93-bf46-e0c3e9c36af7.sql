
-- ============== SEPA MANDATES ==============
CREATE TABLE IF NOT EXISTS public.finance_sepa_mandates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES public.tenants(id),
  mandate_reference text NOT NULL UNIQUE,
  iban text NOT NULL,
  bic text,
  account_holder text,
  signed_at date NOT NULL,
  scheme text NOT NULL DEFAULT 'CORE' CHECK (scheme IN ('CORE','B2B')),
  sequence_type text NOT NULL DEFAULT 'RCUR' CHECK (sequence_type IN ('FRST','RCUR','OOFF','FNAL')),
  status text NOT NULL DEFAULT 'aktiv' CHECK (status IN ('aktiv','pausiert','widerrufen')),
  last_used_at timestamptz,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_sepa_mandates TO authenticated;
GRANT ALL ON public.finance_sepa_mandates TO service_role;
ALTER TABLE public.finance_sepa_mandates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sepa_mandates_select" ON public.finance_sepa_mandates FOR SELECT TO authenticated
USING (public.is_admin() OR public.has_role('Finance') OR public.has_role('Geschäftsführung'));
CREATE POLICY "sepa_mandates_insert" ON public.finance_sepa_mandates FOR INSERT TO authenticated
WITH CHECK (public.is_admin() OR public.has_role('Finance'));
CREATE POLICY "sepa_mandates_update" ON public.finance_sepa_mandates FOR UPDATE TO authenticated
USING (public.is_admin() OR public.has_role('Finance'))
WITH CHECK (public.is_admin() OR public.has_role('Finance'));
CREATE POLICY "sepa_mandates_delete" ON public.finance_sepa_mandates FOR DELETE TO authenticated
USING (public.has_role('Super Admin'));

CREATE TRIGGER trg_sepa_mandates_updated_at BEFORE UPDATE ON public.finance_sepa_mandates
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_sepa_mandates_customer ON public.finance_sepa_mandates(customer_id);

-- ============== SEPA RUNS ==============
CREATE TABLE IF NOT EXISTS public.finance_sepa_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_number text NOT NULL UNIQUE,
  tenant_id uuid REFERENCES public.tenants(id),
  source_system text,
  execution_date date NOT NULL,
  collection_date date NOT NULL,
  creditor_name text NOT NULL,
  creditor_iban text NOT NULL,
  creditor_bic text,
  creditor_id text NOT NULL,
  total_amount numeric(14,2) NOT NULL DEFAULT 0,
  item_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'entwurf' CHECK (status IN ('entwurf','exportiert','eingereicht','verbucht','storniert')),
  xml_path text,
  exported_at timestamptz,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_sepa_runs TO authenticated;
GRANT ALL ON public.finance_sepa_runs TO service_role;
ALTER TABLE public.finance_sepa_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sepa_runs_select" ON public.finance_sepa_runs FOR SELECT TO authenticated
USING (public.is_admin() OR public.has_role('Finance') OR public.has_role('Geschäftsführung'));
CREATE POLICY "sepa_runs_insert" ON public.finance_sepa_runs FOR INSERT TO authenticated
WITH CHECK (public.is_admin() OR public.has_role('Finance'));
CREATE POLICY "sepa_runs_update" ON public.finance_sepa_runs FOR UPDATE TO authenticated
USING (public.is_admin() OR public.has_role('Finance'))
WITH CHECK (public.is_admin() OR public.has_role('Finance'));
CREATE POLICY "sepa_runs_delete" ON public.finance_sepa_runs FOR DELETE TO authenticated
USING (public.has_role('Super Admin'));

CREATE TRIGGER trg_sepa_runs_updated_at BEFORE UPDATE ON public.finance_sepa_runs
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============== SEPA RUN ITEMS ==============
CREATE TABLE IF NOT EXISTS public.finance_sepa_run_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.finance_sepa_runs(id) ON DELETE CASCADE,
  mandate_id uuid NOT NULL REFERENCES public.finance_sepa_mandates(id),
  customer_id uuid NOT NULL REFERENCES public.customers(id),
  transaction_id uuid REFERENCES public.finance_transactions(id),
  reference text,
  amount numeric(14,2) NOT NULL,
  remittance_info text,
  end_to_end_id text,
  status text NOT NULL DEFAULT 'offen' CHECK (status IN ('offen','exportiert','rueckbelastung','erledigt')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_sepa_run_items TO authenticated;
GRANT ALL ON public.finance_sepa_run_items TO service_role;
ALTER TABLE public.finance_sepa_run_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sepa_run_items_select" ON public.finance_sepa_run_items FOR SELECT TO authenticated
USING (public.is_admin() OR public.has_role('Finance') OR public.has_role('Geschäftsführung'));
CREATE POLICY "sepa_run_items_insert" ON public.finance_sepa_run_items FOR INSERT TO authenticated
WITH CHECK (public.is_admin() OR public.has_role('Finance'));
CREATE POLICY "sepa_run_items_update" ON public.finance_sepa_run_items FOR UPDATE TO authenticated
USING (public.is_admin() OR public.has_role('Finance'))
WITH CHECK (public.is_admin() OR public.has_role('Finance'));
CREATE POLICY "sepa_run_items_delete" ON public.finance_sepa_run_items FOR DELETE TO authenticated
USING (public.has_role('Super Admin'));

CREATE INDEX IF NOT EXISTS idx_sepa_run_items_run ON public.finance_sepa_run_items(run_id);
CREATE INDEX IF NOT EXISTS idx_sepa_run_items_mandate ON public.finance_sepa_run_items(mandate_id);

-- ============== SEPA RUN NUMBER SEQUENCE ==============
CREATE SEQUENCE IF NOT EXISTS public.finance_sepa_run_seq START 1;

CREATE OR REPLACE FUNCTION public.assign_sepa_run_number()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.run_number IS NULL OR length(trim(NEW.run_number)) = 0 THEN
    NEW.run_number := 'SEPA-' || to_char(now(),'YYYY') || '-' || lpad(nextval('public.finance_sepa_run_seq')::text, 5, '0');
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_sepa_run_assign_number BEFORE INSERT ON public.finance_sepa_runs
FOR EACH ROW EXECUTE FUNCTION public.assign_sepa_run_number();
