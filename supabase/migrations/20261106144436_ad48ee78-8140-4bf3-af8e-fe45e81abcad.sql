CREATE OR REPLACE FUNCTION public.can_create_internal_note()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.is_internal_staff() AND EXISTS (
    SELECT 1 FROM public.user_profiles p
    WHERE p.id = auth.uid() AND p.account_status = 'active'
      AND p.is_active = true AND p.invitation_status = 'accepted'
      AND p.password_reset_required = false
  );
$$;
REVOKE ALL ON FUNCTION public.can_create_internal_note() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_create_internal_note() TO authenticated, service_role;

ALTER POLICY customer_notes_insert_all_staff ON public.customer_notes
WITH CHECK (author_id = (SELECT auth.uid()) AND (SELECT public.can_create_internal_note())
  AND EXISTS (SELECT 1 FROM public.customers c WHERE c.id = customer_notes.customer_id));
ALTER POLICY order_notes_insert_all_staff ON public.order_notes
WITH CHECK (created_by = (SELECT auth.uid()) AND (SELECT public.can_create_internal_note())
  AND EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_notes.order_id));
ALTER POLICY ticket_messages_insert_internal_note_all_staff ON public.ticket_messages
WITH CHECK (is_internal = true AND (SELECT public.can_create_internal_note())
  AND EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = ticket_messages.ticket_id));