
CREATE TABLE IF NOT EXISTS public.ticket_sync_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type text NOT NULL,
  error_group text,
  ticket_id uuid,
  external_ticket_id text,
  ticket_number text,
  direction text,
  action text,
  response_code int,
  error_message text,
  payload_excerpt jsonb,
  sent_to text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'sent',
  provider_response jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tsa_ticket ON public.ticket_sync_alerts(ticket_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_tsa_ext ON public.ticket_sync_alerts(external_ticket_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_tsa_sent_at ON public.ticket_sync_alerts(sent_at DESC);

GRANT SELECT ON public.ticket_sync_alerts TO authenticated;
GRANT ALL ON public.ticket_sync_alerts TO service_role;

ALTER TABLE public.ticket_sync_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view sync alerts"
ON public.ticket_sync_alerts
FOR SELECT
TO authenticated
USING (public.is_admin());
