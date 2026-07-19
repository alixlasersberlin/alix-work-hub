-- 1. RETENTION
ALTER TABLE public.alixdocs_categories
  ADD COLUMN IF NOT EXISTS retention_years INTEGER,
  ADD COLUMN IF NOT EXISTS hard_delete_allowed BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.alixdocs_documents
  ADD COLUMN IF NOT EXISTS retention_until DATE,
  ADD COLUMN IF NOT EXISTS legal_hold BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS signed_via_sig_request UUID;

UPDATE public.alixdocs_categories SET retention_years = 10, hard_delete_allowed = false, requires_approval = true
  WHERE lower(name) IN ('rechnung','kaufvertrag','mietvertrag','finanzierung') AND retention_years IS NULL;
UPDATE public.alixdocs_categories SET retention_years = 30, hard_delete_allowed = false, requires_approval = true
  WHERE lower(name) = 'nisv' AND retention_years IS NULL;
UPDATE public.alixdocs_categories SET retention_years = 10, hard_delete_allowed = false
  WHERE lower(name) IN ('auftrag','angebot','lieferschein','übergabe','servicebericht','wartung','garantie') AND retention_years IS NULL;
UPDATE public.alixdocs_categories SET retention_years = 5
  WHERE lower(name) IN ('reparatur','schulung','reklamation','kundenkommunikation') AND retention_years IS NULL;

CREATE OR REPLACE FUNCTION public.alixdocs_set_retention()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _years INT;
BEGIN
  IF NEW.retention_until IS NULL AND NEW.category_id IS NOT NULL THEN
    SELECT retention_years INTO _years FROM public.alixdocs_categories WHERE id = NEW.category_id;
    IF _years IS NOT NULL THEN
      NEW.retention_until := (COALESCE(NEW.document_date, CURRENT_DATE) + (_years || ' years')::interval)::date;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_alixdocs_set_retention ON public.alixdocs_documents;
CREATE TRIGGER trg_alixdocs_set_retention
BEFORE INSERT ON public.alixdocs_documents
FOR EACH ROW EXECUTE FUNCTION public.alixdocs_set_retention();

-- 2. APPROVAL-KETTEN
CREATE TABLE IF NOT EXISTS public.alixdocs_approval_chains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category_id UUID REFERENCES public.alixdocs_categories(id) ON DELETE SET NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alixdocs_approval_chains TO authenticated;
GRANT ALL ON public.alixdocs_approval_chains TO service_role;
ALTER TABLE public.alixdocs_approval_chains ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chains admin manage" ON public.alixdocs_approval_chains FOR ALL TO authenticated
  USING (public.has_role('Admin') OR public.has_role('Super Admin'))
  WITH CHECK (public.has_role('Admin') OR public.has_role('Super Admin'));
CREATE POLICY "chains authenticated read" ON public.alixdocs_approval_chains FOR SELECT TO authenticated USING (active = true);

CREATE TABLE IF NOT EXISTS public.alixdocs_approval_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.alixdocs_documents(id) ON DELETE CASCADE,
  chain_id UUID REFERENCES public.alixdocs_approval_chains(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
  current_step INT NOT NULL DEFAULT 0,
  current_approver UUID,
  history JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_alixdocs_approval_states_doc ON public.alixdocs_approval_states(document_id);
CREATE INDEX IF NOT EXISTS idx_alixdocs_approval_states_approver ON public.alixdocs_approval_states(current_approver) WHERE status = 'pending';
GRANT SELECT, INSERT, UPDATE ON public.alixdocs_approval_states TO authenticated;
GRANT ALL ON public.alixdocs_approval_states TO service_role;
ALTER TABLE public.alixdocs_approval_states ENABLE ROW LEVEL SECURITY;
CREATE POLICY "approval states admin all" ON public.alixdocs_approval_states FOR ALL TO authenticated
  USING (public.has_role('Admin') OR public.has_role('Super Admin'))
  WITH CHECK (public.has_role('Admin') OR public.has_role('Super Admin'));
CREATE POLICY "approval states approver read" ON public.alixdocs_approval_states FOR SELECT TO authenticated
  USING (current_approver = auth.uid() OR created_by = auth.uid());
CREATE POLICY "approval states approver act" ON public.alixdocs_approval_states FOR UPDATE TO authenticated
  USING (current_approver = auth.uid()) WITH CHECK (current_approver = auth.uid());

CREATE OR REPLACE FUNCTION public.alixdocs_guard_delete()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _cat TEXT; _hard BOOLEAN; _is_super BOOLEAN;
BEGIN
  SELECT c.name, c.hard_delete_allowed INTO _cat, _hard
    FROM public.alixdocs_categories c WHERE c.id = OLD.category_id;
  _is_super := public.has_role('Super Admin');
  IF OLD.legal_hold THEN
    RAISE EXCEPTION 'Dokument steht unter Legal Hold und kann nicht gelöscht werden.';
  END IF;
  IF OLD.status = 'freigegeben' AND COALESCE(_hard, true) = false AND NOT _is_super THEN
    RAISE EXCEPTION 'Freigegebene %-Dokumente dürfen nur vom Super Admin endgültig gelöscht werden.', _cat;
  END IF;
  IF OLD.retention_until IS NOT NULL AND OLD.retention_until > CURRENT_DATE AND NOT _is_super THEN
    RAISE EXCEPTION 'Aufbewahrungsfrist bis % noch nicht abgelaufen.', OLD.retention_until;
  END IF;
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS trg_alixdocs_guard_delete ON public.alixdocs_documents;
CREATE TRIGGER trg_alixdocs_guard_delete
BEFORE DELETE ON public.alixdocs_documents
FOR EACH ROW EXECUTE FUNCTION public.alixdocs_guard_delete();

-- 3. E-SIGNATUR BRIDGE
ALTER TABLE public.sig_requests
  ADD COLUMN IF NOT EXISTS alixdocs_document_id UUID REFERENCES public.alixdocs_documents(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_sig_requests_alixdocs_doc ON public.sig_requests(alixdocs_document_id) WHERE alixdocs_document_id IS NOT NULL;

-- 4. KUNDENPORTAL-FREIGABE
CREATE TABLE IF NOT EXISTS public.alixdocs_portal_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.alixdocs_documents(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL,
  shared_by UUID NOT NULL,
  shared_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  note TEXT,
  download_count INT NOT NULL DEFAULT 0,
  last_accessed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (document_id, customer_id)
);
CREATE INDEX IF NOT EXISTS idx_alixdocs_portal_shares_customer ON public.alixdocs_portal_shares(customer_id) WHERE revoked_at IS NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alixdocs_portal_shares TO authenticated;
GRANT ALL ON public.alixdocs_portal_shares TO service_role;
ALTER TABLE public.alixdocs_portal_shares ENABLE ROW LEVEL SECURITY;
CREATE POLICY "portal shares admin manage" ON public.alixdocs_portal_shares FOR ALL TO authenticated
  USING (public.has_role('Admin') OR public.has_role('Super Admin'))
  WITH CHECK (public.has_role('Admin') OR public.has_role('Super Admin'));

DROP TRIGGER IF EXISTS trg_alixdocs_chain_updated ON public.alixdocs_approval_chains;
CREATE TRIGGER trg_alixdocs_chain_updated BEFORE UPDATE ON public.alixdocs_approval_chains
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_alixdocs_state_updated ON public.alixdocs_approval_states;
CREATE TRIGGER trg_alixdocs_state_updated BEFORE UPDATE ON public.alixdocs_approval_states
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();