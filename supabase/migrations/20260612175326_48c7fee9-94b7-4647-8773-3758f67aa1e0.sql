
DROP POLICY IF EXISTS alix_sign_signatures_insert ON public.alix_sign_signatures;
DROP POLICY IF EXISTS alix_sign_signatures_update ON public.alix_sign_signatures;

CREATE POLICY alix_sign_signatures_insert
ON public.alix_sign_signatures
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.alix_sign_requests r
    WHERE r.id = sign_request_id
      AND r.created_by = auth.uid()
  )
);

CREATE POLICY alix_sign_signatures_update
ON public.alix_sign_signatures
FOR UPDATE
TO authenticated
USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.alix_sign_requests r
    WHERE r.id = sign_request_id
      AND r.created_by = auth.uid()
  )
)
WITH CHECK (
  public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.alix_sign_requests r
    WHERE r.id = sign_request_id
      AND r.created_by = auth.uid()
  )
);
