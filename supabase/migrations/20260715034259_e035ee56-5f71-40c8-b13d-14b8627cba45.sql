DROP POLICY IF EXISTS "esc_events_ticket_events_read" ON public.esc_events;

CREATE POLICY "esc_events_ticket_events_read"
ON public.esc_events
FOR SELECT
TO authenticated
USING (
  deleted_at IS NULL
  AND source = 'ticket'
);