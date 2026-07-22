
CREATE TABLE public.alixdocs2_nc_servers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, base_url TEXT NOT NULL, username TEXT NOT NULL,
  app_password_secret_name TEXT NOT NULL,
  verify_ssl BOOLEAN NOT NULL DEFAULT true, active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT, created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alixdocs2_nc_servers TO authenticated;
GRANT ALL ON public.alixdocs2_nc_servers TO service_role;
ALTER TABLE public.alixdocs2_nc_servers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ad2_servers_admin_select" ON public.alixdocs2_nc_servers FOR SELECT TO authenticated USING (public.has_role('Admin') OR public.has_role('Super Admin'));
CREATE POLICY "ad2_servers_admin_insert" ON public.alixdocs2_nc_servers FOR INSERT TO authenticated WITH CHECK (public.has_role('Admin') OR public.has_role('Super Admin'));
CREATE POLICY "ad2_servers_admin_update" ON public.alixdocs2_nc_servers FOR UPDATE TO authenticated USING (public.has_role('Admin') OR public.has_role('Super Admin'));
CREATE POLICY "ad2_servers_superadmin_delete" ON public.alixdocs2_nc_servers FOR DELETE TO authenticated USING (public.has_role('Super Admin'));

CREATE TABLE public.alixdocs2_nc_watched_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id UUID NOT NULL REFERENCES public.alixdocs2_nc_servers(id) ON DELETE CASCADE,
  path TEXT NOT NULL, doc_type_hint TEXT, recursive BOOLEAN NOT NULL DEFAULT true,
  poll_interval_min INTEGER NOT NULL DEFAULT 5, active BOOLEAN NOT NULL DEFAULT true,
  last_scanned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (server_id, path)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alixdocs2_nc_watched_folders TO authenticated;
GRANT ALL ON public.alixdocs2_nc_watched_folders TO service_role;
ALTER TABLE public.alixdocs2_nc_watched_folders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ad2_folders_admin_all" ON public.alixdocs2_nc_watched_folders FOR ALL TO authenticated
  USING (public.has_role('Admin') OR public.has_role('Super Admin'))
  WITH CHECK (public.has_role('Admin') OR public.has_role('Super Admin'));

CREATE TABLE public.alixdocs2_nc_sync_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id UUID REFERENCES public.alixdocs2_nc_servers(id) ON DELETE SET NULL,
  folder_id UUID REFERENCES public.alixdocs2_nc_watched_folders(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(), finished_at TIMESTAMPTZ,
  files_seen INTEGER NOT NULL DEFAULT 0, files_new INTEGER NOT NULL DEFAULT 0,
  files_updated INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'running', error TEXT
);
GRANT SELECT, INSERT, UPDATE ON public.alixdocs2_nc_sync_runs TO authenticated;
GRANT ALL ON public.alixdocs2_nc_sync_runs TO service_role;
ALTER TABLE public.alixdocs2_nc_sync_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ad2_runs_admin_read" ON public.alixdocs2_nc_sync_runs FOR SELECT TO authenticated USING (public.has_role('Admin') OR public.has_role('Super Admin'));

CREATE TABLE public.alixdocs2_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nc_server_id UUID REFERENCES public.alixdocs2_nc_servers(id) ON DELETE SET NULL,
  nc_path TEXT NOT NULL, etag TEXT, size_bytes BIGINT, mime TEXT, sha256 TEXT,
  title TEXT, status TEXT NOT NULL DEFAULT 'neu',
  doc_type TEXT, language TEXT, ai_confidence NUMERIC(5,2),
  ai_entities JSONB NOT NULL DEFAULT '{}'::jsonb,
  ai_tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ocr_text TEXT, ai_processed_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ, approved_by UUID REFERENCES auth.users(id),
  deleted_at TIMESTAMPTZ, created_by UUID REFERENCES auth.users(id),
  search_tsv tsvector,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (nc_server_id, nc_path)
);
GRANT SELECT, INSERT, UPDATE ON public.alixdocs2_documents TO authenticated;
GRANT ALL ON public.alixdocs2_documents TO service_role;
ALTER TABLE public.alixdocs2_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ad2_docs_authenticated_read" ON public.alixdocs2_documents FOR SELECT TO authenticated USING (deleted_at IS NULL);
CREATE POLICY "ad2_docs_admin_insert" ON public.alixdocs2_documents FOR INSERT TO authenticated WITH CHECK (public.has_role('Admin') OR public.has_role('Super Admin'));
CREATE POLICY "ad2_docs_admin_update" ON public.alixdocs2_documents FOR UPDATE TO authenticated USING (public.has_role('Admin') OR public.has_role('Super Admin'));

CREATE INDEX ad2_docs_status_idx ON public.alixdocs2_documents (status) WHERE deleted_at IS NULL;
CREATE INDEX ad2_docs_doc_type_idx ON public.alixdocs2_documents (doc_type);
CREATE INDEX ad2_docs_sha256_idx ON public.alixdocs2_documents (sha256);
CREATE INDEX ad2_docs_tags_idx ON public.alixdocs2_documents USING GIN (ai_tags);
CREATE INDEX ad2_docs_entities_idx ON public.alixdocs2_documents USING GIN (ai_entities);
CREATE INDEX ad2_docs_search_tsv_idx ON public.alixdocs2_documents USING GIN (search_tsv);

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX ad2_docs_title_trgm ON public.alixdocs2_documents USING GIN (title gin_trgm_ops);

CREATE OR REPLACE FUNCTION public.ad2_docs_tsv_trigger()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.search_tsv :=
    setweight(to_tsvector('german', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('german', coalesce(array_to_string(NEW.ai_tags, ' '), '')), 'B') ||
    setweight(to_tsvector('german', coalesce(NEW.ocr_text, '')), 'C');
  RETURN NEW;
END $$;
CREATE TRIGGER ad2_docs_tsv_upd BEFORE INSERT OR UPDATE OF title, ai_tags, ocr_text
  ON public.alixdocs2_documents FOR EACH ROW EXECUTE FUNCTION public.ad2_docs_tsv_trigger();

CREATE TABLE public.alixdocs2_relations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.alixdocs2_documents(id) ON DELETE CASCADE,
  linked_type TEXT NOT NULL, linked_id UUID NOT NULL,
  confidence NUMERIC(5,2), source TEXT NOT NULL DEFAULT 'ai',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (document_id, linked_type, linked_id)
);
GRANT SELECT, INSERT, DELETE ON public.alixdocs2_relations TO authenticated;
GRANT ALL ON public.alixdocs2_relations TO service_role;
ALTER TABLE public.alixdocs2_relations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ad2_rel_read" ON public.alixdocs2_relations FOR SELECT TO authenticated USING (true);
CREATE POLICY "ad2_rel_admin_insert" ON public.alixdocs2_relations FOR INSERT TO authenticated WITH CHECK (public.has_role('Admin') OR public.has_role('Super Admin'));
CREATE POLICY "ad2_rel_admin_delete" ON public.alixdocs2_relations FOR DELETE TO authenticated USING (public.has_role('Admin') OR public.has_role('Super Admin'));
CREATE INDEX ad2_rel_doc_idx ON public.alixdocs2_relations (document_id);
CREATE INDEX ad2_rel_linked_idx ON public.alixdocs2_relations (linked_type, linked_id);

CREATE TABLE public.alixdocs2_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.alixdocs2_documents(id) ON DELETE CASCADE,
  version INTEGER NOT NULL, etag TEXT, sha256 TEXT, size_bytes BIGINT,
  nc_path TEXT, note TEXT, created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (document_id, version)
);
GRANT SELECT, INSERT ON public.alixdocs2_versions TO authenticated;
GRANT ALL ON public.alixdocs2_versions TO service_role;
ALTER TABLE public.alixdocs2_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ad2_ver_read" ON public.alixdocs2_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "ad2_ver_admin_insert" ON public.alixdocs2_versions FOR INSERT TO authenticated WITH CHECK (public.has_role('Admin') OR public.has_role('Super Admin'));

CREATE TABLE public.alixdocs2_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES public.alixdocs2_documents(id) ON DELETE SET NULL,
  actor UUID REFERENCES auth.users(id), action TEXT NOT NULL,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.alixdocs2_audit TO authenticated;
GRANT ALL ON public.alixdocs2_audit TO service_role;
ALTER TABLE public.alixdocs2_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ad2_audit_admin_read" ON public.alixdocs2_audit FOR SELECT TO authenticated USING (public.has_role('Admin') OR public.has_role('Super Admin'));
CREATE POLICY "ad2_audit_authenticated_insert" ON public.alixdocs2_audit FOR INSERT TO authenticated WITH CHECK (actor = auth.uid());

CREATE TABLE public.alixdocs2_doctypes (
  code TEXT PRIMARY KEY, label TEXT NOT NULL, description TEXT, color TEXT,
  required BOOLEAN NOT NULL DEFAULT false, sort_order INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.alixdocs2_doctypes TO authenticated;
GRANT ALL ON public.alixdocs2_doctypes TO service_role;
ALTER TABLE public.alixdocs2_doctypes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ad2_dt_read" ON public.alixdocs2_doctypes FOR SELECT TO authenticated USING (true);
CREATE POLICY "ad2_dt_admin_write" ON public.alixdocs2_doctypes FOR ALL TO authenticated
  USING (public.has_role('Admin') OR public.has_role('Super Admin'))
  WITH CHECK (public.has_role('Admin') OR public.has_role('Super Admin'));

INSERT INTO public.alixdocs2_doctypes(code, label, sort_order) VALUES
  ('rechnung','Rechnung',10),('angebot','Angebot',20),('auftrag','Auftragsbestätigung',30),
  ('lieferschein','Lieferschein',40),('servicebericht','Servicebericht',50),
  ('wartungsbericht','Wartungsbericht',60),('garantie','Garantie',70),
  ('reklamation','Reklamation',80),('ticket','Ticket',90),('vertrag','Vertrag',100),
  ('schulung','Schulung',110),('nisv','NiSV',120),('iso','ISO',130),('mdr','MDR',140),
  ('ce','CE',150),('anleitung','Bedienungsanleitung',160),('tech_doc','Technische Dokumentation',170),
  ('notiz','Interne Notiz',180),('sonstiges','Sonstiges',999)
ON CONFLICT (code) DO NOTHING;

CREATE OR REPLACE FUNCTION public.ad2_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER ad2_servers_touch BEFORE UPDATE ON public.alixdocs2_nc_servers FOR EACH ROW EXECUTE FUNCTION public.ad2_touch_updated_at();
CREATE TRIGGER ad2_folders_touch BEFORE UPDATE ON public.alixdocs2_nc_watched_folders FOR EACH ROW EXECUTE FUNCTION public.ad2_touch_updated_at();
CREATE TRIGGER ad2_docs_touch BEFORE UPDATE ON public.alixdocs2_documents FOR EACH ROW EXECUTE FUNCTION public.ad2_touch_updated_at();
