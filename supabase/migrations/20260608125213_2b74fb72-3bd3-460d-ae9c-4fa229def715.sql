
DROP POLICY IF EXISTS portal_customer_select_own_tickets ON public.tickets;

CREATE POLICY portal_customer_select_own_tickets
ON public.tickets
FOR SELECT
TO authenticated
USING (
  customer_email IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.customers c
    WHERE c.id = public.current_portal_customer_id()
      AND lower(c.email) = lower(tickets.customer_email)
  )
);

REVOKE SELECT (mfa_recovery_codes_hash) ON public.user_profiles FROM authenticated;
