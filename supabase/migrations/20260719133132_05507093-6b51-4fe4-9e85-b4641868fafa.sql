DROP POLICY IF EXISTS ticket_attachments_select ON public.ticket_attachments;
CREATE POLICY ticket_attachments_select ON public.ticket_attachments
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.tickets t
    WHERE t.id = ticket_attachments.ticket_id
      AND (
        is_admin()
        OR has_role('Kundenservice'::text)
        OR has_role('Technik'::text)
        OR (has_role('Finance'::text) AND t.department = 'finance'::text)
        OR (has_role('Tourenplanung'::text) AND t.department = ANY (ARRAY['lieferung'::text,'abholung'::text,'austausch'::text,'tourenplanung'::text]))
      )
  )
);