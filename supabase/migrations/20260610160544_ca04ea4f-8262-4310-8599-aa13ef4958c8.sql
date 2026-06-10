
CREATE TABLE public.finance_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  report_type TEXT NOT NULL DEFAULT 'custom',
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  dimensions JSONB NOT NULL DEFAULT '[]'::jsonb,
  metrics JSONB NOT NULL DEFAULT '[]'::jsonb,
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  visualization TEXT DEFAULT 'table',
  is_shared BOOLEAN NOT NULL DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_reports TO authenticated;
GRANT ALL ON public.finance_reports TO service_role;
ALTER TABLE public.finance_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fr_select" ON public.finance_reports FOR SELECT TO authenticated
  USING (public.has_role('Super Admin') OR public.has_role('Admin') OR public.has_role('Finance') OR public.has_role('Geschäftsführung'));
CREATE POLICY "fr_insert" ON public.finance_reports FOR INSERT TO authenticated
  WITH CHECK (public.has_role('Super Admin') OR public.has_role('Admin') OR public.has_role('Finance'));
CREATE POLICY "fr_update" ON public.finance_reports FOR UPDATE TO authenticated
  USING (public.has_role('Super Admin') OR public.has_role('Admin') OR public.has_role('Finance'));
CREATE POLICY "fr_delete" ON public.finance_reports FOR DELETE TO authenticated
  USING (public.has_role('Super Admin'));

CREATE TABLE public.finance_report_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  report_id UUID REFERENCES public.finance_reports(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  cron_expression TEXT NOT NULL,
  recipients JSONB NOT NULL DEFAULT '[]'::jsonb,
  output_format TEXT NOT NULL DEFAULT 'pdf',
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_run_at TIMESTAMPTZ,
  last_status TEXT,
  next_run_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_report_schedules TO authenticated;
GRANT ALL ON public.finance_report_schedules TO service_role;
ALTER TABLE public.finance_report_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "frs_select" ON public.finance_report_schedules FOR SELECT TO authenticated
  USING (public.has_role('Super Admin') OR public.has_role('Admin') OR public.has_role('Finance') OR public.has_role('Geschäftsführung'));
CREATE POLICY "frs_insert" ON public.finance_report_schedules FOR INSERT TO authenticated
  WITH CHECK (public.has_role('Super Admin') OR public.has_role('Admin') OR public.has_role('Finance'));
CREATE POLICY "frs_update" ON public.finance_report_schedules FOR UPDATE TO authenticated
  USING (public.has_role('Super Admin') OR public.has_role('Admin') OR public.has_role('Finance'));
CREATE POLICY "frs_delete" ON public.finance_report_schedules FOR DELETE TO authenticated
  USING (public.has_role('Super Admin'));

CREATE TABLE public.finance_management_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  sections JSONB NOT NULL DEFAULT '[]'::jsonb,
  generated_at TIMESTAMPTZ,
  pdf_url TEXT,
  sent_to JSONB NOT NULL DEFAULT '[]'::jsonb,
  sent_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_management_packs TO authenticated;
GRANT ALL ON public.finance_management_packs TO service_role;
ALTER TABLE public.finance_management_packs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fmp_select" ON public.finance_management_packs FOR SELECT TO authenticated
  USING (public.has_role('Super Admin') OR public.has_role('Admin') OR public.has_role('Finance') OR public.has_role('Geschäftsführung'));
CREATE POLICY "fmp_insert" ON public.finance_management_packs FOR INSERT TO authenticated
  WITH CHECK (public.has_role('Super Admin') OR public.has_role('Admin') OR public.has_role('Finance'));
CREATE POLICY "fmp_update" ON public.finance_management_packs FOR UPDATE TO authenticated
  USING (public.has_role('Super Admin') OR public.has_role('Admin') OR public.has_role('Finance'));
CREATE POLICY "fmp_delete" ON public.finance_management_packs FOR DELETE TO authenticated
  USING (public.has_role('Super Admin'));

CREATE TABLE public.finance_stakeholders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer',
  access_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  allowed_reports JSONB NOT NULL DEFAULT '[]'::jsonb,
  expires_at TIMESTAMPTZ,
  last_access_at TIMESTAMPTZ,
  access_count INTEGER NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_stakeholders TO authenticated;
GRANT ALL ON public.finance_stakeholders TO service_role;
ALTER TABLE public.finance_stakeholders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fs_select" ON public.finance_stakeholders FOR SELECT TO authenticated
  USING (public.has_role('Super Admin') OR public.has_role('Geschäftsführung'));
CREATE POLICY "fs_insert" ON public.finance_stakeholders FOR INSERT TO authenticated
  WITH CHECK (public.has_role('Super Admin') OR public.has_role('Geschäftsführung'));
CREATE POLICY "fs_update" ON public.finance_stakeholders FOR UPDATE TO authenticated
  USING (public.has_role('Super Admin') OR public.has_role('Geschäftsführung'));
CREATE POLICY "fs_delete" ON public.finance_stakeholders FOR DELETE TO authenticated
  USING (public.has_role('Super Admin'));

CREATE TABLE public.finance_stakeholder_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stakeholder_id UUID REFERENCES public.finance_stakeholders(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  ip_address TEXT,
  user_agent TEXT,
  accessed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.finance_stakeholder_access_logs TO authenticated;
GRANT ALL ON public.finance_stakeholder_access_logs TO service_role;
ALTER TABLE public.finance_stakeholder_access_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fsal_select" ON public.finance_stakeholder_access_logs FOR SELECT TO authenticated
  USING (public.has_role('Super Admin') OR public.has_role('Geschäftsführung'));
CREATE POLICY "fsal_insert" ON public.finance_stakeholder_access_logs FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY "fsal_delete" ON public.finance_stakeholder_access_logs FOR DELETE TO authenticated
  USING (public.has_role('Super Admin'));

CREATE TRIGGER trg_finance_reports_updated BEFORE UPDATE ON public.finance_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_finance_report_schedules_updated BEFORE UPDATE ON public.finance_report_schedules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_finance_management_packs_updated BEFORE UPDATE ON public.finance_management_packs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_finance_stakeholders_updated BEFORE UPDATE ON public.finance_stakeholders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_finance_reports_tenant ON public.finance_reports(tenant_id);
CREATE INDEX idx_finance_report_schedules_next_run ON public.finance_report_schedules(next_run_at) WHERE enabled = true;
CREATE INDEX idx_finance_management_packs_period ON public.finance_management_packs(period_start, period_end);
CREATE INDEX idx_finance_stakeholders_token ON public.finance_stakeholders(access_token) WHERE enabled = true;
CREATE INDEX idx_fsal_stakeholder ON public.finance_stakeholder_access_logs(stakeholder_id, accessed_at DESC);
