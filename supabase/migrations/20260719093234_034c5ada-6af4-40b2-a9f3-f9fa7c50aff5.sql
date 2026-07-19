
ALTER TABLE public.alixdocs_documents ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_alixdocs_documents_tags ON public.alixdocs_documents USING gin(tags);

CREATE TABLE IF NOT EXISTS public.alixdocs_share_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  document_ids UUID[] NOT NULL,
  created_by UUID,
  note TEXT,
  password_hash TEXT,
  expires_at TIMESTAMPTZ,
  max_downloads INTEGER,
  download_count INTEGER NOT NULL DEFAULT 0,
  revoked_at TIMESTAMPTZ,
  last_accessed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alixdocs_share_links TO authenticated;
GRANT ALL ON public.alixdocs_share_links TO service_role;
ALTER TABLE public.alixdocs_share_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin/SuperAdmin manage share links"
  ON public.alixdocs_share_links FOR ALL
  USING (public.has_role('Admin') OR public.has_role('Super Admin'))
  WITH CHECK (public.has_role('Admin') OR public.has_role('Super Admin'));
CREATE POLICY "Creator can read own share links"
  ON public.alixdocs_share_links FOR SELECT
  USING (created_by = auth.uid());
CREATE INDEX IF NOT EXISTS idx_alixdocs_share_links_token ON public.alixdocs_share_links(token);
CREATE INDEX IF NOT EXISTS idx_alixdocs_share_links_creator ON public.alixdocs_share_links(created_by);

CREATE OR REPLACE FUNCTION public.tg_alixdocs_share_links_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS trg_alixdocs_share_links_uat ON public.alixdocs_share_links;
CREATE TRIGGER trg_alixdocs_share_links_uat BEFORE UPDATE ON public.alixdocs_share_links
FOR EACH ROW EXECUTE FUNCTION public.tg_alixdocs_share_links_updated_at();

CREATE OR REPLACE FUNCTION public.tg_alixdocs_approval_notify()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_title TEXT;
BEGIN
  IF NEW.assigned_to IS NULL THEN RETURN NEW; END IF;
  SELECT title INTO v_title FROM public.alixdocs_documents WHERE id = NEW.document_id;
  INSERT INTO public.app_notifications (user_id, category, priority, title, message, action_url, metadata)
  VALUES (
    NEW.assigned_to,
    'alixdocs_approval',
    'normal',
    'AlixDocs: Freigabe angefordert',
    'Dokument "' || COALESCE(v_title,'?') || '" wartet auf deine Freigabe (Schritt ' || NEW.step_index || ').',
    '/dokumente/freigaben',
    jsonb_build_object('document_id', NEW.document_id, 'approval_state_id', NEW.id, 'step_index', NEW.step_index)
  );
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_alixdocs_approval_notify ON public.alixdocs_approval_states;
CREATE TRIGGER trg_alixdocs_approval_notify
AFTER INSERT ON public.alixdocs_approval_states
FOR EACH ROW WHEN (NEW.status = 'ausstehend')
EXECUTE FUNCTION public.tg_alixdocs_approval_notify();
