
-- Helper: Berechtigung für Copilot-Konfiguration
CREATE OR REPLACE FUNCTION public.can_manage_copilot_config()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.is_admin()
      OR public.has_role('Geschäftsführung')
      OR public.has_role('QM');
$$;

-- 1. copilot_sources
CREATE TABLE IF NOT EXISTS public.copilot_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  category text,
  department text,
  source_type text NOT NULL DEFAULT 'text',
  file_path text,
  url text,
  status text NOT NULL DEFAULT 'active',
  visible_to_copilot boolean NOT NULL DEFAULT true,
  last_import_at timestamptz,
  owner_user_id uuid,
  version text,
  valid_from date,
  valid_to date,
  tags text[] DEFAULT '{}'::text[],
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.copilot_sources TO authenticated;
GRANT ALL ON public.copilot_sources TO service_role;
ALTER TABLE public.copilot_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "copilot_sources_select" ON public.copilot_sources FOR SELECT TO authenticated USING (public.can_manage_copilot_config());
CREATE POLICY "copilot_sources_insert" ON public.copilot_sources FOR INSERT TO authenticated WITH CHECK (public.can_manage_copilot_config());
CREATE POLICY "copilot_sources_update" ON public.copilot_sources FOR UPDATE TO authenticated USING (public.can_manage_copilot_config()) WITH CHECK (public.can_manage_copilot_config());
CREATE POLICY "copilot_sources_delete" ON public.copilot_sources FOR DELETE TO authenticated USING (public.has_role('Super Admin'));

-- 2. copilot_source_files
CREATE TABLE IF NOT EXISTS public.copilot_source_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES public.copilot_sources(id) ON DELETE CASCADE,
  storage_path text,
  filename text,
  mime text,
  size_bytes bigint,
  pages int,
  extracted_chars int,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.copilot_source_files TO authenticated;
GRANT ALL ON public.copilot_source_files TO service_role;
ALTER TABLE public.copilot_source_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "copilot_source_files_all" ON public.copilot_source_files FOR ALL TO authenticated USING (public.can_manage_copilot_config()) WITH CHECK (public.can_manage_copilot_config());

-- 3. copilot_departments
CREATE TABLE IF NOT EXISTS public.copilot_departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  search_documents boolean NOT NULL DEFAULT true,
  search_tickets boolean NOT NULL DEFAULT true,
  search_customers boolean NOT NULL DEFAULT true,
  search_devices boolean NOT NULL DEFAULT true,
  search_repairs boolean NOT NULL DEFAULT true,
  search_offers boolean NOT NULL DEFAULT true,
  search_invoices boolean NOT NULL DEFAULT false,
  search_maintenance boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.copilot_departments TO authenticated;
GRANT ALL ON public.copilot_departments TO service_role;
ALTER TABLE public.copilot_departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "copilot_departments_all" ON public.copilot_departments FOR ALL TO authenticated USING (public.can_manage_copilot_config()) WITH CHECK (public.can_manage_copilot_config());

-- 4. copilot_module_access
CREATE TABLE IF NOT EXISTS public.copilot_module_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_key text NOT NULL UNIQUE,
  label text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  read_allowed boolean NOT NULL DEFAULT true,
  write_allowed boolean NOT NULL DEFAULT false,
  data_scope text,
  role_restrictions text[] DEFAULT '{}'::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.copilot_module_access TO authenticated;
GRANT ALL ON public.copilot_module_access TO service_role;
ALTER TABLE public.copilot_module_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY "copilot_module_access_all" ON public.copilot_module_access FOR ALL TO authenticated USING (public.can_manage_copilot_config()) WITH CHECK (public.can_manage_copilot_config());

-- 5. copilot_import_jobs
CREATE TABLE IF NOT EXISTS public.copilot_import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES public.copilot_sources(id) ON DELETE SET NULL,
  filename text,
  category text,
  department text,
  tags text[] DEFAULT '{}'::text[],
  status text NOT NULL DEFAULT 'pending',
  recognized_items int DEFAULT 0,
  error_message text,
  version text,
  started_by uuid DEFAULT auth.uid(),
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.copilot_import_jobs TO authenticated;
GRANT ALL ON public.copilot_import_jobs TO service_role;
ALTER TABLE public.copilot_import_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "copilot_import_jobs_all" ON public.copilot_import_jobs FOR ALL TO authenticated USING (public.can_manage_copilot_config()) WITH CHECK (public.can_manage_copilot_config());

-- 6. copilot_knowledge_entries
CREATE TABLE IF NOT EXISTS public.copilot_knowledge_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  category text,
  department text,
  priority text NOT NULL DEFAULT 'mittel',
  source text,
  version text,
  status text NOT NULL DEFAULT 'active',
  valid_from date,
  valid_to date,
  responsible_user_id uuid,
  tags text[] DEFAULT '{}'::text[],
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.copilot_knowledge_entries TO authenticated;
GRANT ALL ON public.copilot_knowledge_entries TO service_role;
ALTER TABLE public.copilot_knowledge_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "copilot_knowledge_all" ON public.copilot_knowledge_entries FOR ALL TO authenticated USING (public.can_manage_copilot_config()) WITH CHECK (public.can_manage_copilot_config());

-- 7. copilot_settings (singleton)
CREATE TABLE IF NOT EXISTS public.copilot_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE DEFAULT 'global',
  only_approved_sources boolean NOT NULL DEFAULT true,
  cite_sources boolean NOT NULL DEFAULT true,
  prioritize_internal boolean NOT NULL DEFAULT true,
  prioritize_iso boolean NOT NULL DEFAULT true,
  restrict_customer_data boolean NOT NULL DEFAULT true,
  restrict_finance_data boolean NOT NULL DEFAULT true,
  restrict_pii boolean NOT NULL DEFAULT true,
  mark_uncertain boolean NOT NULL DEFAULT true,
  auto_language boolean NOT NULL DEFAULT true,
  tone text NOT NULL DEFAULT 'professional',
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.copilot_settings TO authenticated;
GRANT ALL ON public.copilot_settings TO service_role;
ALTER TABLE public.copilot_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "copilot_settings_select" ON public.copilot_settings FOR SELECT TO authenticated USING (public.can_manage_copilot_config());
CREATE POLICY "copilot_settings_upsert" ON public.copilot_settings FOR INSERT TO authenticated WITH CHECK (public.can_manage_copilot_config());
CREATE POLICY "copilot_settings_update" ON public.copilot_settings FOR UPDATE TO authenticated USING (public.can_manage_copilot_config()) WITH CHECK (public.can_manage_copilot_config());

INSERT INTO public.copilot_settings (key) VALUES ('global') ON CONFLICT (key) DO NOTHING;

-- 8. copilot_audit_log
CREATE TABLE IF NOT EXISTS public.copilot_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity text NOT NULL,
  entity_id text,
  action text NOT NULL,
  before jsonb,
  after jsonb,
  user_id uuid DEFAULT auth.uid(),
  ip text,
  session_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.copilot_audit_log TO authenticated;
GRANT ALL ON public.copilot_audit_log TO service_role;
ALTER TABLE public.copilot_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "copilot_audit_select" ON public.copilot_audit_log FOR SELECT TO authenticated USING (public.can_manage_copilot_config());

-- Trigger Funktion: updated_at + Audit
CREATE OR REPLACE FUNCTION public.copilot_set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE OR REPLACE FUNCTION public.copilot_audit_trigger_fn()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_old jsonb; v_new jsonb; v_id text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_new := to_jsonb(NEW); v_id := (v_new->>'id');
  ELSIF TG_OP = 'UPDATE' THEN
    IF to_jsonb(NEW) = to_jsonb(OLD) THEN RETURN NEW; END IF;
    v_old := to_jsonb(OLD); v_new := to_jsonb(NEW); v_id := (v_new->>'id');
  ELSE
    v_old := to_jsonb(OLD); v_id := (v_old->>'id');
  END IF;
  BEGIN
    INSERT INTO public.copilot_audit_log(entity, entity_id, action, before, after, user_id)
    VALUES (TG_TABLE_NAME, v_id, TG_OP, v_old, v_new, auth.uid());
  EXCEPTION WHEN OTHERS THEN NULL; END;
  RETURN COALESCE(NEW, OLD);
END $$;

-- Trigger anhängen
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['copilot_sources','copilot_source_files','copilot_departments','copilot_module_access','copilot_import_jobs','copilot_knowledge_entries','copilot_settings'])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_updated_at ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.copilot_set_updated_at()', t, t);
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_audit ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%I_audit AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.copilot_audit_trigger_fn()', t, t);
  END LOOP;
END $$;

-- Seed Abteilungen
INSERT INTO public.copilot_departments (key, label) VALUES
  ('vertrieb','Vertrieb'),('finance','Finance'),('service','Service'),('technik','Technik'),
  ('reparaturannahme','Reparaturannahme'),('tourenplanung','Tourenplanung'),
  ('kundenservice','Kundenservice'),('marketing','Marketing'),('geschaeftsfuehrung','Geschäftsführung'),
  ('iso_qm','ISO / QM'),('akademie','Akademie / Schulung'),('lager','Lager / Ersatzteile')
ON CONFLICT (key) DO NOTHING;

-- Seed Module
INSERT INTO public.copilot_module_access (module_key, label) VALUES
  ('customers','Kunden'),('orders','Aufträge'),('offers','Angebote'),('invoices','Rechnungen'),
  ('tickets','Tickets'),('repairs','Reparaturen'),('quotes','Kostenvoranschläge'),
  ('device_lifecycle','Geräteakte'),('maintenance','Wartungsmanagement'),
  ('warranty','Garantie & Kulanz'),('spare_parts','Ersatzteile'),('route_planning','Tourenplanung'),
  ('management_dashboard','Management Dashboard'),('ai_service','AI Service Center'),
  ('email_templates','E-Mail Templates'),('sms_templates','SMS Templates'),('documents','Dokumente / PDFs')
ON CONFLICT (module_key) DO NOTHING;

-- Storage Bucket Policies (Bucket selbst wird per Tool angelegt)
