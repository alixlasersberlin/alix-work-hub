DROP POLICY IF EXISTS alix_sign_audit_select ON public.alix_sign_audit_log;
CREATE POLICY alix_sign_audit_select ON public.alix_sign_audit_log
FOR SELECT TO authenticated
USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.alix_sign_requests r
    WHERE r.id = alix_sign_audit_log.sign_request_id
      AND r.created_by = auth.uid()
  )
);