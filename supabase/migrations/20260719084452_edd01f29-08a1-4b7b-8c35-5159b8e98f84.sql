
-- Add workflow + provenance columns
ALTER TABLE public.alixdocs_documents
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS verified_by uuid,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';
-- source examples: 'manual' | 'auto_pdf' | 'mail_attachment' | 'zoho' | 'signature'

-- Search index (immutable to_tsvector on generated text)
CREATE INDEX IF NOT EXISTS idx_alixdocs_documents_fts
  ON public.alixdocs_documents
  USING gin (to_tsvector('simple',
    coalesce(title,'') || ' ' || coalesce(description,'') || ' ' ||
    coalesce(original_filename,'') || ' ' || coalesce(serial_number,'')));

CREATE INDEX IF NOT EXISTS idx_alixdocs_documents_order ON public.alixdocs_documents(order_id);
CREATE INDEX IF NOT EXISTS idx_alixdocs_documents_customer ON public.alixdocs_documents(customer_id);
CREATE INDEX IF NOT EXISTS idx_alixdocs_documents_status ON public.alixdocs_documents(status);

-- Roles allowed to change status / approve
CREATE OR REPLACE FUNCTION public.alixdocs_can_manage_status()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.has_role('Super Admin') OR
    public.has_role('Admin') OR
    public.has_role('Geschäftsführung') OR
    public.has_role('Buchhaltung') OR
    public.has_role('Order');
$$;

-- Categories that are legally protected once released
CREATE OR REPLACE FUNCTION public.alixdocs_is_protected_category(_cat_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.alixdocs_categories
    WHERE id = _cat_id
      AND code IN ('kaufvertrag','mietvertrag','finanzierung','rechnung')
  );
$$;

-- Trigger: block soft-delete/purge of released protected documents (except Super Admin)
CREATE OR REPLACE FUNCTION public.alixdocs_guard_release()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.deleted_at IS NOT NULL
     AND OLD.deleted_at IS NULL
     AND OLD.status = 'freigegeben'
     AND public.alixdocs_is_protected_category(OLD.category_id)
     AND NOT public.has_role('Super Admin')
  THEN
    RAISE EXCEPTION 'ALIXDOCS_RELEASE_LOCKED: Freigegebene Verträge/Rechnungen können nur vom Super Admin gelöscht werden.';
  END IF;

  IF TG_OP = 'DELETE'
     AND OLD.status = 'freigegeben'
     AND public.alixdocs_is_protected_category(OLD.category_id)
     AND NOT public.has_role('Super Admin')
  THEN
    RAISE EXCEPTION 'ALIXDOCS_RELEASE_LOCKED: Hard-Delete freigegebener Dokumente nur durch Super Admin.';
  END IF;

  -- Auto-stamp approver / verifier when status transitions
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'freigegeben' AND NEW.approved_at IS NULL THEN
      NEW.approved_at := now();
      NEW.approved_by := auth.uid();
    ELSIF NEW.status = 'geprueft' AND NEW.verified_at IS NULL THEN
      NEW.verified_at := now();
      NEW.verified_by := auth.uid();
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_alixdocs_guard_release_upd ON public.alixdocs_documents;
CREATE TRIGGER trg_alixdocs_guard_release_upd
  BEFORE UPDATE ON public.alixdocs_documents
  FOR EACH ROW EXECUTE FUNCTION public.alixdocs_guard_release();

DROP TRIGGER IF EXISTS trg_alixdocs_guard_release_del ON public.alixdocs_documents;
CREATE TRIGGER trg_alixdocs_guard_release_del
  BEFORE DELETE ON public.alixdocs_documents
  FOR EACH ROW EXECUTE FUNCTION public.alixdocs_guard_release();
