CREATE TABLE public.sig_facsimile_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_type TEXT NOT NULL UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  image_path TEXT NOT NULL,
  signer_name TEXT NOT NULL DEFAULT 'H. Tran',
  signer_title TEXT,
  pos_x NUMERIC NOT NULL DEFAULT 380,
  pos_y NUMERIC NOT NULL DEFAULT 90,
  width NUMERIC NOT NULL DEFAULT 160,
  height NUMERIC NOT NULL DEFAULT 60,
  show_name_line BOOLEAN NOT NULL DEFAULT true,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.sig_facsimile_settings TO authenticated;
GRANT ALL ON public.sig_facsimile_settings TO service_role;

ALTER TABLE public.sig_facsimile_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "facsimile_settings_read_auth"
  ON public.sig_facsimile_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "facsimile_settings_insert_super"
  ON public.sig_facsimile_settings FOR INSERT TO authenticated
  WITH CHECK (public.has_role('Super Admin'));

CREATE POLICY "facsimile_settings_update_super"
  ON public.sig_facsimile_settings FOR UPDATE TO authenticated
  USING (public.has_role('Super Admin'))
  WITH CHECK (public.has_role('Super Admin'));

CREATE POLICY "facsimile_settings_delete_super"
  ON public.sig_facsimile_settings FOR DELETE TO authenticated
  USING (public.has_role('Super Admin'));

CREATE TRIGGER trg_sig_facsimile_settings_updated_at
  BEFORE UPDATE ON public.sig_facsimile_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.sig_facsimile_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_type TEXT NOT NULL,
  document_ref TEXT,
  applied_by UUID,
  settings_id UUID REFERENCES public.sig_facsimile_settings(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.sig_facsimile_log TO authenticated;
GRANT ALL ON public.sig_facsimile_log TO service_role;

ALTER TABLE public.sig_facsimile_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "facsimile_log_read_admins"
  ON public.sig_facsimile_log FOR SELECT TO authenticated
  USING (public.has_role('Super Admin') OR public.has_role('Admin'));

CREATE POLICY "facsimile_log_insert_auth"
  ON public.sig_facsimile_log FOR INSERT TO authenticated
  WITH CHECK (true);