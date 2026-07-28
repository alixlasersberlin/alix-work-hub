
CREATE OR REPLACE FUNCTION public.tickets_dashboard_counts(_user_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH now_ts AS (SELECT now() AS n),
  bounds AS (
    SELECT date_trunc('day', n) AS start_of_day,
           date_trunc('day', n) + interval '1 day' AS end_of_day,
           n AS now_ts
    FROM now_ts
  ),
  open_states AS (
    SELECT unnest(ARRAY['open','offen','in-progress','in_bearbeitung','wartet_kunde','wartet_Kunde','Neu','Zugewiesen','In Bearbeitung']) AS s
  )
  SELECT jsonb_build_object(
    'neu',            (SELECT count(*) FROM tickets WHERE status IN ('open','offen','Neu')),
    'meine',          (SELECT count(*) FROM tickets WHERE assigned_to = _user_id AND status IN (SELECT s FROM open_states)),
    'heute',          (SELECT count(*) FROM tickets, bounds WHERE due_at >= start_of_day AND due_at < end_of_day AND status IN (SELECT s FROM open_states)),
    'ueberfaellig',   (SELECT count(*) FROM tickets, bounds WHERE due_at < now_ts AND status IN (SELECT s FROM open_states)),
    'termine_heute',  (SELECT count(*) FROM tickets, bounds WHERE appointment_at >= start_of_day AND appointment_at < end_of_day),
    'warten_kunde',   (SELECT count(*) FROM tickets WHERE status IN ('wartet_kunde','wartet_Kunde','Warten auf Kunde')),
    'eskaliert',      (SELECT count(*) FROM tickets WHERE escalation_count > 0 AND status IN (SELECT s FROM open_states)),
    'total_offen',    (SELECT count(*) FROM tickets WHERE status IN (SELECT s FROM open_states)),
    'sla_warning',    (SELECT count(*) FROM tickets WHERE sla_status IN ('warning','warn_response','warn_progress') AND status IN (SELECT s FROM open_states)),
    'sla_breach',     (SELECT count(*) FROM tickets WHERE sla_status = 'breach' AND status IN (SELECT s FROM open_states))
  );
$$;

GRANT EXECUTE ON FUNCTION public.tickets_dashboard_counts(uuid) TO authenticated;

-- Helpful partial indexes for hot filters
CREATE INDEX IF NOT EXISTS idx_tickets_status_assigned ON public.tickets (assigned_to, status);
CREATE INDEX IF NOT EXISTS idx_tickets_due_at ON public.tickets (due_at) WHERE due_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tickets_appointment_at ON public.tickets (appointment_at) WHERE appointment_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tickets_sla_status ON public.tickets (sla_status);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON public.tickets (status);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON public.tickets (created_at);
CREATE INDEX IF NOT EXISTS idx_tickets_updated_at ON public.tickets (updated_at);
