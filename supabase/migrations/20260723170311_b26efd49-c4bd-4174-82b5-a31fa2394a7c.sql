
DROP POLICY IF EXISTS ticket_attachments_select ON public.ticket_attachments;

CREATE POLICY ticket_attachments_select ON public.ticket_attachments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.tickets t WHERE t.id = ticket_attachments.ticket_id
  )
);
