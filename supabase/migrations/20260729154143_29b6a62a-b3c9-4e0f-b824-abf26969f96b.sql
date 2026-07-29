DROP POLICY IF EXISTS ticket_messages_insert ON public.ticket_messages;

CREATE POLICY ticket_messages_insert ON public.ticket_messages
FOR INSERT TO authenticated
WITH CHECK (
  public.can_manage_tickets()
  OR (
    is_internal = true
    AND EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = ticket_messages.ticket_id
        AND (
          public.is_admin()
          OR public.has_role('Kundenservice')
          OR public.has_role('Technik')
          OR public.has_role('QM')
          OR (public.has_role('Finance') AND t.department = 'finance')
          OR (public.has_role('Tourenplanung') AND t.department = ANY (ARRAY['lieferung','abholung','austausch','tourenplanung']))
        )
    )
  )
);