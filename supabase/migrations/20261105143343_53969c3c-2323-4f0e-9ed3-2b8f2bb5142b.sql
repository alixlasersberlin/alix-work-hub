CREATE POLICY customer_notes_insert_all_staff ON public.customer_notes FOR INSERT TO authenticated
WITH CHECK (author_id = auth.uid() AND (SELECT public.is_internal_staff()) AND NOT (SELECT public.has_role('Read Only'::text))
  AND EXISTS (SELECT 1 FROM public.customers c WHERE c.id = customer_notes.customer_id));

CREATE POLICY order_notes_insert_all_staff ON public.order_notes FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid() AND (SELECT public.is_internal_staff()) AND NOT (SELECT public.has_role('Read Only'::text))
  AND EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_notes.order_id));

CREATE POLICY ticket_messages_insert_internal_note_all_staff ON public.ticket_messages FOR INSERT TO authenticated
WITH CHECK (is_internal = true AND (SELECT public.is_internal_staff()) AND NOT (SELECT public.has_role('Read Only'::text))
  AND EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = ticket_messages.ticket_id));