CREATE TABLE public.ticket_outbound_sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  external_ticket_id text,
  action text NOT NULL,
  status text NOT NULL,
  error_message text,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.ticket_outbound_sync_logs TO authenticated;
GRANT ALL ON public.ticket_outbound_sync_logs TO service_role;

ALTER TABLE public.ticket_outbound_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ticket users can view outbound sync logs"
  ON public.ticket_outbound_sync_logs FOR SELECT
  TO authenticated
  USING (public.can_access_tickets());

CREATE POLICY "Ticket managers can insert outbound sync logs"
  ON public.ticket_outbound_sync_logs FOR INSERT
  TO authenticated
  WITH CHECK (public.can_manage_tickets());

CREATE INDEX idx_ticket_outbound_sync_logs_ticket ON public.ticket_outbound_sync_logs(ticket_id, created_at DESC);

ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS last_outbound_sync_at timestamptz;