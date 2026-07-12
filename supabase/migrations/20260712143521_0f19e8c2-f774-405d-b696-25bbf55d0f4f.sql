
CREATE TABLE public.portal_ticket_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  ticket_id uuid NOT NULL,
  last_viewed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (customer_id, ticket_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.portal_ticket_reads TO authenticated;
GRANT ALL ON public.portal_ticket_reads TO service_role;

ALTER TABLE public.portal_ticket_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "portal_reads_select_own" ON public.portal_ticket_reads
FOR SELECT TO authenticated
USING (customer_id = current_portal_customer_id());

CREATE POLICY "portal_reads_insert_own" ON public.portal_ticket_reads
FOR INSERT TO authenticated
WITH CHECK (customer_id = current_portal_customer_id());

CREATE POLICY "portal_reads_update_own" ON public.portal_ticket_reads
FOR UPDATE TO authenticated
USING (customer_id = current_portal_customer_id())
WITH CHECK (customer_id = current_portal_customer_id());

-- Realtime aktivieren
ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_attachments;
