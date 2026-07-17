
-- Fix 1: as_cases_update scope to authenticated
DROP POLICY IF EXISTS as_cases_update ON public.as_cases;
CREATE POLICY as_cases_update ON public.as_cases
FOR UPDATE TO authenticated
USING (has_role('Super Admin'::text) OR has_role('Admin'::text) OR has_role('After Sales'::text) OR has_role('Vertrieb'::text) OR has_role('Marketing'::text) OR has_role('Service'::text) OR has_role('Order'::text) OR has_role('SACHBEARBEITUNG'::text))
WITH CHECK (has_role('Super Admin'::text) OR has_role('Admin'::text) OR has_role('After Sales'::text) OR has_role('Vertrieb'::text) OR has_role('Marketing'::text) OR has_role('Service'::text) OR has_role('Order'::text) OR has_role('SACHBEARBEITUNG'::text));

-- Fix 2: sig_documents_select restrict broad role access
DROP POLICY IF EXISTS sig_documents_select ON public.sig_documents;
CREATE POLICY sig_documents_select ON public.sig_documents
FOR SELECT TO authenticated
USING (
  sig_is_admin()
  OR created_by = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.sig_requests r
    JOIN public.sig_signers s ON s.request_id = r.id
    WHERE r.document_id = sig_documents.id
      AND lower(s.email) = lower((auth.jwt() ->> 'email'))
  )
);
