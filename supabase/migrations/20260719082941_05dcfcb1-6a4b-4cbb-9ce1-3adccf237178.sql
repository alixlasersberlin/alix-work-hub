
CREATE TABLE public.alixdocs_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  sort_order int NOT NULL DEFAULT 100,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.alixdocs_categories TO authenticated;
GRANT ALL ON public.alixdocs_categories TO service_role;
ALTER TABLE public.alixdocs_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cat_read_auth" ON public.alixdocs_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "cat_admin_write" ON public.alixdocs_categories FOR ALL TO authenticated
  USING (public.has_role('Super Admin') OR public.has_role('Admin'))
  WITH CHECK (public.has_role('Super Admin') OR public.has_role('Admin'));

INSERT INTO public.alixdocs_categories (code,name,sort_order,is_system) VALUES
  ('angebot','Angebot',10,true),('auftrag','Auftrag',20,true),('kaufvertrag','Kaufvertrag',30,true),
  ('mietvertrag','Mietvertrag',40,true),('finanzierung','Finanzierung',50,true),('rechnung','Rechnung',60,true),
  ('zahlung','Zahlung',70,true),('lieferschein','Lieferschein',80,true),('uebergabe','Übergabe',90,true),
  ('geraetefoto','Gerätefoto',100,true),('seriennummer','Seriennummer',110,true),('servicebericht','Servicebericht',120,true),
  ('reparatur','Reparatur',130,true),('wartung','Wartung',140,true),('garantie','Garantie',150,true),
  ('schulung','Schulung',160,true),('nisv','NiSV',170,true),('mediapaket','Mediapaket',180,true),
  ('reklamation','Reklamation',190,true),('kundenkommunikation','Kundenkommunikation',200,true),
  ('intern_vertraulich','Intern vertraulich',210,true),('sonstiges','Sonstiges',900,true);

CREATE TABLE public.alixdocs_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  device_id uuid,
  serial_number text,
  category_id uuid REFERENCES public.alixdocs_categories(id),
  title text NOT NULL,
  description text,
  document_date date,
  mime_type text NOT NULL,
  file_size bigint NOT NULL DEFAULT 0,
  original_filename text,
  current_version int NOT NULL DEFAULT 1,
  confidentiality_level text NOT NULL DEFAULT 'normal' CHECK (confidentiality_level IN ('normal','vertraulich','streng_vertraulich')),
  status text NOT NULL DEFAULT 'entwurf' CHECK (status IN ('entwurf','geprueft','freigegeben','archiviert')),
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  deleted_at timestamptz,
  purge_after timestamptz
);
CREATE INDEX idx_alixdocs_order ON public.alixdocs_documents(order_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_alixdocs_customer ON public.alixdocs_documents(customer_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_alixdocs_serial ON public.alixdocs_documents(serial_number) WHERE deleted_at IS NULL;
CREATE INDEX idx_alixdocs_deleted ON public.alixdocs_documents(deleted_at);

GRANT SELECT, INSERT, UPDATE ON public.alixdocs_documents TO authenticated;
GRANT ALL ON public.alixdocs_documents TO service_role;
ALTER TABLE public.alixdocs_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "docs_read" ON public.alixdocs_documents FOR SELECT TO authenticated
USING (
  deleted_at IS NULL AND (
    confidentiality_level <> 'streng_vertraulich'
    OR public.has_role('Super Admin') OR public.has_role('Admin')
    OR public.has_role('Geschäftsführung') OR public.has_role('Buchhaltung')
  )
);
CREATE POLICY "docs_insert" ON public.alixdocs_documents FOR INSERT TO authenticated
WITH CHECK (uploaded_by = auth.uid());
CREATE POLICY "docs_update" ON public.alixdocs_documents FOR UPDATE TO authenticated
USING (
  public.has_role('Super Admin') OR public.has_role('Admin')
  OR public.has_role('Geschäftsführung') OR public.has_role('Buchhaltung')
  OR public.has_role('Order') OR uploaded_by = auth.uid()
);
CREATE POLICY "docs_delete_superadmin" ON public.alixdocs_documents FOR DELETE TO authenticated
USING (public.has_role('Super Admin'));

CREATE TRIGGER trg_alixdocs_docs_updated_at
BEFORE UPDATE ON public.alixdocs_documents
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.alixdocs_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.alixdocs_documents(id) ON DELETE CASCADE,
  version_number int NOT NULL,
  storage_bucket text NOT NULL DEFAULT 'alixdocs-private',
  storage_path text NOT NULL,
  file_hash text,
  file_size bigint NOT NULL DEFAULT 0,
  mime_type text NOT NULL,
  original_filename text,
  change_note text,
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, version_number)
);
CREATE INDEX idx_alixdocs_versions_doc ON public.alixdocs_versions(document_id);
GRANT SELECT, INSERT ON public.alixdocs_versions TO authenticated;
GRANT ALL ON public.alixdocs_versions TO service_role;
ALTER TABLE public.alixdocs_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ver_read" ON public.alixdocs_versions FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.alixdocs_documents d WHERE d.id = document_id AND d.deleted_at IS NULL));
CREATE POLICY "ver_insert" ON public.alixdocs_versions FOR INSERT TO authenticated
WITH CHECK (uploaded_by = auth.uid());
CREATE POLICY "ver_delete_superadmin" ON public.alixdocs_versions FOR DELETE TO authenticated
USING (public.has_role('Super Admin'));

CREATE TABLE public.alixdocs_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid REFERENCES public.alixdocs_documents(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id),
  action text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip inet,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_alixdocs_audit_doc ON public.alixdocs_audit_log(document_id, created_at DESC);
GRANT SELECT, INSERT ON public.alixdocs_audit_log TO authenticated;
GRANT ALL ON public.alixdocs_audit_log TO service_role;
ALTER TABLE public.alixdocs_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_read_admin" ON public.alixdocs_audit_log FOR SELECT TO authenticated
USING (public.has_role('Super Admin') OR public.has_role('Admin') OR public.has_role('Geschäftsführung'));
CREATE POLICY "audit_insert" ON public.alixdocs_audit_log FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());
