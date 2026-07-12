
-- Portal-Kunden dürfen Nachrichten & Anhänge ihrer eigenen Tickets sehen und antworten
CREATE POLICY "portal_customer_select_own_messages" ON public.ticket_messages
FOR SELECT TO authenticated
USING (
  is_internal = false
  AND EXISTS (
    SELECT 1 FROM public.tickets t
    JOIN public.customers c ON lower(c.email) = lower(t.customer_email)
    WHERE t.id = ticket_messages.ticket_id
      AND c.id = current_portal_customer_id()
  )
);

CREATE POLICY "portal_customer_insert_own_messages" ON public.ticket_messages
FOR INSERT TO authenticated
WITH CHECK (
  is_internal = false
  AND sender_type = 'customer'
  AND EXISTS (
    SELECT 1 FROM public.tickets t
    JOIN public.customers c ON lower(c.email) = lower(t.customer_email)
    WHERE t.id = ticket_messages.ticket_id
      AND c.id = current_portal_customer_id()
  )
);

CREATE POLICY "portal_customer_select_own_attachments" ON public.ticket_attachments
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tickets t
    JOIN public.customers c ON lower(c.email) = lower(t.customer_email)
    WHERE t.id = ticket_attachments.ticket_id
      AND c.id = current_portal_customer_id()
  )
);
