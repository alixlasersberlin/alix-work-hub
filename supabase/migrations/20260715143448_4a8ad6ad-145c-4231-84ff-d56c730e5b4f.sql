
CREATE OR REPLACE FUNCTION public.can_approve_role_request(_request_id uuid, _step_no integer, _approver_role_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.role_change_requests rcr
    JOIN public.role_approval_chains rac
      ON rac.role_id = rcr.role_id
     AND rac.step_no = _step_no
     AND rac.required_role_name = _approver_role_name
    JOIN public.user_roles ur ON ur.user_id = auth.uid()
    JOIN public.roles r ON r.id = ur.role_id AND r.name = rac.required_role_name
    WHERE rcr.id = _request_id
  );
$$;

DROP POLICY IF EXISTS "Approver insert own" ON public.role_request_approvals;

CREATE POLICY "Approver insert own"
ON public.role_request_approvals
FOR INSERT
TO authenticated
WITH CHECK (
  approver_id = auth.uid()
  AND public.can_approve_role_request(request_id, step_no, approver_role_name)
);
