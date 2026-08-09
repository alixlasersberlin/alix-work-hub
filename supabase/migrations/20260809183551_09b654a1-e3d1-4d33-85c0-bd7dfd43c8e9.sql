CREATE OR REPLACE FUNCTION public.tickets_dashboard_counts(_user_id uuid, _source_system text DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH now_ts AS (SELECT now() AS n),
  bounds AS (
    SELECT date_trunc('day', n) AS start_of_day,
           date_trunc('day', n) + interval '1 day' AS end_of_day,
           n AS now_ts
    FROM now_ts
  ),
  open_states AS (
    SELECT unnest(ARRAY['open','offen','in-progress','in_bearbeitung','wartet_kunde','wartet_Kunde','Neu','Zugewiesen','In Bearbeitung']) AS s
  ),
  t AS (
    SELECT * FROM tickets
    WHERE _source_system IS NULL OR source_system = _source_system
  )
  SELECT jsonb_build_object(
    'neu',            (SELECT count(*) FROM t WHERE status IN ('open','offen','Neu')),
    'meine',          (SELECT count(*) FROM t WHERE assigned_to = _user_id AND status IN (SELECT s FROM open_states)),
    'heute',          (SELECT count(*) FROM t, bounds WHERE due_at >= start_of_day AND due_at < end_of_day AND status IN (SELECT s FROM open_states)),
    'ueberfaellig',   (SELECT count(*) FROM t, bounds WHERE due_at < now_ts AND status IN (SELECT s FROM open_states)),
    'termine_heute',  (SELECT count(*) FROM t, bounds WHERE appointment_at >= start_of_day AND appointment_at < end_of_day),
    'warten_kunde',   (SELECT count(*) FROM t WHERE status IN ('wartet_kunde','wartet_Kunde','Warten auf Kunde')),
    'eskaliert',      (SELECT count(*) FROM t WHERE escalation_count > 0 AND status IN (SELECT s FROM open_states)),
    'total_offen',    (SELECT count(*) FROM t WHERE status IN (SELECT s FROM open_states)),
    'sla_warning',    (SELECT count(*) FROM t WHERE sla_status IN ('warning','warn_response','warn_progress') AND status IN (SELECT s FROM open_states)),
    'sla_breach',     (SELECT count(*) FROM t WHERE sla_status = 'breach' AND status IN (SELECT s FROM open_states))
  );
$function$;