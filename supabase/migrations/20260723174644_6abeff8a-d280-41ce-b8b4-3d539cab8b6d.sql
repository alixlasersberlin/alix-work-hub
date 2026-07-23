
-- Fix 1: Restrict ac_websites SELECT to Admin/Super Admin only (removes broad staff read of api_key)
DROP POLICY IF EXISTS "ac_websites staff read" ON public.ac_websites;
CREATE POLICY "ac_websites admin read"
  ON public.ac_websites
  FOR SELECT
  TO authenticated
  USING (has_role('Super Admin'::text) OR has_role('Admin'::text));

-- Fix 2: Validation trigger for sig_documents to ensure customer_id integrity for portal-visible docs
CREATE OR REPLACE FUNCTION public.sig_documents_validate_customer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If entity is customer-related, customer_id must be set
  IF NEW.entity_type IN ('customer','order','offer','invoice','contract','repair')
     AND NEW.customer_id IS NULL THEN
    RAISE EXCEPTION 'sig_documents.customer_id is required for entity_type=% (prevents portal cross-tenant exposure)', NEW.entity_type;
  END IF;

  -- If customer_id is set, verify it references a real customer
  IF NEW.customer_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.customers WHERE id = NEW.customer_id) THEN
    RAISE EXCEPTION 'sig_documents.customer_id % does not reference an existing customer', NEW.customer_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sig_documents_validate_customer ON public.sig_documents;
CREATE TRIGGER trg_sig_documents_validate_customer
  BEFORE INSERT OR UPDATE OF customer_id, entity_type ON public.sig_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.sig_documents_validate_customer();
