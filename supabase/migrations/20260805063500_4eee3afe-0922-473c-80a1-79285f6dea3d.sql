ALTER TABLE public.cmr_settings
  ADD COLUMN IF NOT EXISTS advance_notice_active boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS advance_notice_days integer NOT NULL DEFAULT 5;

ALTER TABLE public.cmr_recurring_plans
  ADD COLUMN IF NOT EXISTS last_notice_at timestamptz;

ALTER TABLE public.cmr_payments
  ADD COLUMN IF NOT EXISTS credit_document_id uuid REFERENCES public.cmr_documents(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.cmr_customer_dunning (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  customer_id uuid,
  customer_name text,
  days_1 integer NOT NULL DEFAULT 7,
  days_2 integer NOT NULL DEFAULT 14,
  days_3 integer NOT NULL DEFAULT 30,
  gap_days integer NOT NULL DEFAULT 7,
  fee_1 numeric NOT NULL DEFAULT 0,
  fee_2 numeric NOT NULL DEFAULT 0,
  fee_3 numeric NOT NULL DEFAULT 0,
  interest_pct numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, customer_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cmr_customer_dunning TO authenticated;
GRANT ALL ON public.cmr_customer_dunning TO service_role;
ALTER TABLE public.cmr_customer_dunning ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cmr_customer_dunning_read" ON public.cmr_customer_dunning
  FOR SELECT TO authenticated
  USING (
    public.has_role('Super Admin') OR
    public.has_role('Admin') OR
    public.has_role('Geschäftsführung') OR
    public.has_role('CMR') OR
    public.has_role('CMR Viewer')
  );

CREATE POLICY "cmr_customer_dunning_write" ON public.cmr_customer_dunning
  FOR ALL TO authenticated
  USING (public.cmr_can_write())
  WITH CHECK (public.cmr_can_write());

CREATE TABLE IF NOT EXISTS public.cmr_time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  project_id uuid REFERENCES public.cmr_projects(id) ON DELETE SET NULL,
  customer_id uuid,
  customer_name text,
  work_date date NOT NULL DEFAULT current_date,
  hours numeric NOT NULL DEFAULT 0,
  hourly_rate numeric NOT NULL DEFAULT 0,
  description text,
  billable boolean NOT NULL DEFAULT true,
  billed_document_id uuid REFERENCES public.cmr_documents(id) ON DELETE SET NULL,
  billed_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cmr_time_entries_tenant_date ON public.cmr_time_entries (tenant_id, work_date DESC);
CREATE INDEX IF NOT EXISTS idx_cmr_time_entries_project ON public.cmr_time_entries (project_id);
CREATE INDEX IF NOT EXISTS idx_cmr_time_entries_open ON public.cmr_time_entries (tenant_id, billable, billed_document_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cmr_time_entries TO authenticated;
GRANT ALL ON public.cmr_time_entries TO service_role;
ALTER TABLE public.cmr_time_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cmr_time_entries_read" ON public.cmr_time_entries
  FOR SELECT TO authenticated
  USING (
    public.has_role('Super Admin') OR
    public.has_role('Admin') OR
    public.has_role('Geschäftsführung') OR
    public.has_role('CMR') OR
    public.has_role('CMR Viewer')
  );

CREATE POLICY "cmr_time_entries_write" ON public.cmr_time_entries
  FOR ALL TO authenticated
  USING (public.cmr_can_write())
  WITH CHECK (public.cmr_can_write());

CREATE TRIGGER trg_cmr_customer_dunning_updated
  BEFORE UPDATE ON public.cmr_customer_dunning
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_cmr_time_entries_updated
  BEFORE UPDATE ON public.cmr_time_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();