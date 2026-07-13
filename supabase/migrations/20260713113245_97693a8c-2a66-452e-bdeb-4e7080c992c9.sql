
CREATE TABLE public.catalog_import_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('airtable','website')),
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_run_at TIMESTAMPTZ,
  last_status TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalog_import_sources TO authenticated;
GRANT ALL ON public.catalog_import_sources TO service_role;
ALTER TABLE public.catalog_import_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cis_admin_all" ON public.catalog_import_sources FOR ALL TO authenticated
  USING (has_role('Super Admin'::text) OR has_role('Admin'::text) OR has_role('Katalog'::text))
  WITH CHECK (has_role('Super Admin'::text) OR has_role('Admin'::text) OR has_role('Katalog'::text));

CREATE TABLE public.catalog_import_jobs_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID REFERENCES public.catalog_import_sources(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  stats JSONB NOT NULL DEFAULT '{}'::jsonb,
  log TEXT,
  triggered_by UUID,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalog_import_jobs_v2 TO authenticated;
GRANT ALL ON public.catalog_import_jobs_v2 TO service_role;
ALTER TABLE public.catalog_import_jobs_v2 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cij2_admin_all" ON public.catalog_import_jobs_v2 FOR ALL TO authenticated
  USING (has_role('Super Admin'::text) OR has_role('Admin'::text) OR has_role('Katalog'::text))
  WITH CHECK (has_role('Super Admin'::text) OR has_role('Admin'::text) OR has_role('Katalog'::text));

CREATE TABLE public.catalog_reminder_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('missing_translation','stale_price','missing_image','stale_bundle')),
  threshold_days INTEGER NOT NULL DEFAULT 90,
  notify_emails TEXT[] NOT NULL DEFAULT '{}',
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalog_reminder_rules TO authenticated;
GRANT ALL ON public.catalog_reminder_rules TO service_role;
ALTER TABLE public.catalog_reminder_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crr_admin_all" ON public.catalog_reminder_rules FOR ALL TO authenticated
  USING (has_role('Super Admin'::text) OR has_role('Admin'::text) OR has_role('Katalog'::text))
  WITH CHECK (has_role('Super Admin'::text) OR has_role('Admin'::text) OR has_role('Katalog'::text));

CREATE TABLE public.catalog_reminder_log_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID REFERENCES public.catalog_reminder_rules(id) ON DELETE SET NULL,
  target_type TEXT NOT NULL,
  target_id UUID,
  target_label TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  notified_emails TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalog_reminder_log_v2 TO authenticated;
GRANT ALL ON public.catalog_reminder_log_v2 TO service_role;
ALTER TABLE public.catalog_reminder_log_v2 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crl2_admin_all" ON public.catalog_reminder_log_v2 FOR ALL TO authenticated
  USING (has_role('Super Admin'::text) OR has_role('Admin'::text) OR has_role('Katalog'::text))
  WITH CHECK (has_role('Super Admin'::text) OR has_role('Admin'::text) OR has_role('Katalog'::text));

CREATE TABLE public.catalog_pdf_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'item' CHECK (scope IN ('item','bundle','category')),
  language TEXT NOT NULL DEFAULT 'de',
  header_html TEXT,
  body_html TEXT NOT NULL DEFAULT '',
  footer_html TEXT,
  accent_color TEXT DEFAULT '#c9a24a',
  logo_url TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalog_pdf_templates TO authenticated;
GRANT ALL ON public.catalog_pdf_templates TO service_role;
ALTER TABLE public.catalog_pdf_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cpt_read_all" ON public.catalog_pdf_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "cpt_write_admin" ON public.catalog_pdf_templates FOR ALL TO authenticated
  USING (has_role('Super Admin'::text) OR has_role('Admin'::text) OR has_role('Katalog'::text))
  WITH CHECK (has_role('Super Admin'::text) OR has_role('Admin'::text) OR has_role('Katalog'::text));

CREATE TRIGGER trg_cis_updated BEFORE UPDATE ON public.catalog_import_sources FOR EACH ROW EXECUTE FUNCTION public.catalog_touch_updated_at();
CREATE TRIGGER trg_crr_updated BEFORE UPDATE ON public.catalog_reminder_rules FOR EACH ROW EXECUTE FUNCTION public.catalog_touch_updated_at();
CREATE TRIGGER trg_cpt_updated BEFORE UPDATE ON public.catalog_pdf_templates FOR EACH ROW EXECUTE FUNCTION public.catalog_touch_updated_at();
