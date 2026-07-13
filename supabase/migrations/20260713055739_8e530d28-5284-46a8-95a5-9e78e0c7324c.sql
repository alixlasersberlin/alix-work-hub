
-- role_change_requests: only allow requesting roles that have an approval chain configured
DROP POLICY IF EXISTS "Authenticated can create request for themselves or as super adm" ON public.role_change_requests;

CREATE POLICY "Users can request roles with configured approval chain"
ON public.role_change_requests
FOR INSERT
TO authenticated
WITH CHECK (
  has_role('Super Admin'::text)
  OR (
    requested_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.role_approval_chains rac WHERE rac.role_id = role_change_requests.role_id
    )
  )
);

-- ticket_notifications: restrict insert target to self, or to users with ticket access
DROP POLICY IF EXISTS "ticket_notifications insert authenticated" ON public.ticket_notifications;

CREATE POLICY "ticket_notifications insert scoped"
ON public.ticket_notifications
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  OR has_role('Super Admin'::text)
  OR (ticket_id IS NOT NULL AND can_read_ticket(ticket_id))
);
