CREATE TABLE public.cmr_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  code text,
  name text NOT NULL,
  customer_id uuid,
  customer_name text,
  status text NOT NULL DEFAULT 'geplant',
  start_date date,
  end_date date,
  budget numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'AED',
  description text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cmr_projects TO authenticated;
GRANT ALL ON public.cmr_projects TO service_role;
ALTER TABLE public.cmr_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY cmr_projects_read ON public.cmr_projects FOR SELECT TO authenticated USING (has_tenant_access(tenant_id));
CREATE POLICY cmr_projects_insert ON public.cmr_projects FOR INSERT TO authenticated WITH CHECK (has_tenant_access(tenant_id));
CREATE POLICY cmr_projects_update ON public.cmr_projects FOR UPDATE TO authenticated USING (has_tenant_access(tenant_id)) WITH CHECK (has_tenant_access(tenant_id));
CREATE POLICY cmr_projects_delete ON public.cmr_projects FOR DELETE TO authenticated USING (has_role('Super Admin'::text));

CREATE TABLE public.cmr_recurring_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  name text NOT NULL,
  customer_id uuid,
  customer_name text,
  customer_email text,
  billing_address text,
  interval_unit text NOT NULL DEFAULT 'monthly',
  next_run_date date NOT NULL DEFAULT (now()::date),
  currency text NOT NULL DEFAULT 'AED',
  tax_rate numeric NOT NULL DEFAULT 0,
  lines jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cmr_recurring_plans TO authenticated;
GRANT ALL ON public.cmr_recurring_plans TO service_role;
ALTER TABLE public.cmr_recurring_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY cmr_recplans_read ON public.cmr_recurring_plans FOR SELECT TO authenticated USING (has_tenant_access(tenant_id));
CREATE POLICY cmr_recplans_insert ON public.cmr_recurring_plans FOR INSERT TO authenticated WITH CHECK (has_tenant_access(tenant_id));
CREATE POLICY cmr_recplans_update ON public.cmr_recurring_plans FOR UPDATE TO authenticated USING (has_tenant_access(tenant_id)) WITH CHECK (has_tenant_access(tenant_id));
CREATE POLICY cmr_recplans_delete ON public.cmr_recurring_plans FOR DELETE TO authenticated USING (has_role('Super Admin'::text));

ALTER TABLE public.cmr_documents
  ADD COLUMN IF NOT EXISTS reminder_level integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_reminded_at timestamptz,
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.cmr_projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cmr_projects_tenant ON public.cmr_projects(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_cmr_recplans_tenant ON public.cmr_recurring_plans(tenant_id, is_active, next_run_date);
CREATE INDEX IF NOT EXISTS idx_cmr_documents_project ON public.cmr_documents(project_id);

CREATE TRIGGER trg_cmr_projects_touch BEFORE UPDATE ON public.cmr_projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_cmr_recplans_touch BEFORE UPDATE ON public.cmr_recurring_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();