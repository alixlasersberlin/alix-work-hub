DROP POLICY IF EXISTS ticket_messages_select ON public.ticket_messages;
CREATE POLICY ticket_messages_select ON public.ticket_messages
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tickets t
    WHERE t.id = ticket_messages.ticket_id
      AND (
        (SELECT is_admin() OR has_role('Kundenservice') OR has_role('Technik') OR has_role('SACHBEARBEITUNG') OR has_role('QM'))
        OR ((SELECT has_role('Finance')) AND t.department = 'finance')
        OR ((SELECT has_role('Tourenplanung')) AND t.department = ANY (ARRAY['lieferung','abholung','austausch','tourenplanung']))
      )
  )
);

DROP POLICY IF EXISTS ticket_attachments_select ON public.ticket_attachments;
CREATE POLICY ticket_attachments_select ON public.ticket_attachments
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tickets t
    WHERE t.id = ticket_attachments.ticket_id
      AND (
        (SELECT is_admin() OR has_role('Kundenservice') OR has_role('Technik') OR has_role('SACHBEARBEITUNG') OR has_role('QM'))
        OR ((SELECT has_role('Finance')) AND t.department = 'finance')
        OR ((SELECT has_role('Tourenplanung')) AND t.department = ANY (ARRAY['lieferung','abholung','austausch','tourenplanung']))
      )
  )
);