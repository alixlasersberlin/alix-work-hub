CREATE OR REPLACE FUNCTION public.ac_wfm_adherence_live()
RETURNS TABLE(agent_id uuid, agent_name text, scheduled_minutes int, actual_minutes int, adherence_pct numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH sched AS (
    SELECT s.agent_id,
           SUM(EXTRACT(EPOCH FROM (LEAST(s.shift_end, now()) - GREATEST(s.shift_start, now() - interval '24 hours'))) / 60)::int AS mins
    FROM ac_wfm_shifts s
    WHERE s.shift_start < now() AND s.shift_end > now() - interval '24 hours'
      AND s.status IN ('scheduled','confirmed','auto')
    GROUP BY s.agent_id
  ),
  actual AS (
    SELECT p.user_id AS agent_id,
           SUM(EXTRACT(EPOCH FROM (LEAST(COALESCE(p.last_seen_at, now()), now()) - GREATEST(p.updated_at, now() - interval '24 hours'))) / 60)::int AS mins
    FROM ac_user_presence p
    WHERE p.status = 'online' AND p.last_seen_at > now() - interval '24 hours'
    GROUP BY p.user_id
  )
  SELECT COALESCE(s.agent_id, a.agent_id),
         u.full_name,
         COALESCE(s.mins, 0),
         COALESCE(a.mins, 0),
         CASE WHEN COALESCE(s.mins, 0) > 0
              THEN ROUND(100.0 * LEAST(COALESCE(a.mins,0), s.mins) / s.mins, 1)
              ELSE 0 END
  FROM sched s
  FULL OUTER JOIN actual a ON a.agent_id = s.agent_id
  LEFT JOIN user_profiles u ON u.id = COALESCE(s.agent_id, a.agent_id)
  ORDER BY 5 DESC NULLS LAST;
$$;
GRANT EXECUTE ON FUNCTION public.ac_wfm_adherence_live() TO authenticated;

CREATE OR REPLACE FUNCTION public.ac_wfm_auto_forecast(horizon_hours int DEFAULT 24)
RETURNS TABLE(interval_start timestamptz, channel text, predicted_volume int, required_agents int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH hist AS (
    SELECT EXTRACT(HOUR FROM created_at)::int AS h,
           EXTRACT(DOW FROM created_at)::int AS dow,
           COALESCE(channel_type::text, 'other') AS ch,
           COUNT(*)::numeric / 4.0 AS avg_per_hour
    FROM ac_conversations
    WHERE created_at > now() - interval '30 days'
    GROUP BY h, dow, ch
  ),
  slots AS (
    SELECT generate_series(date_trunc('hour', now()), now() + (horizon_hours || ' hours')::interval, interval '1 hour') AS ts
  ),
  channels AS (SELECT DISTINCT ch FROM hist)
  SELECT s.ts,
         c.ch,
         COALESCE(CEIL(h.avg_per_hour)::int, 0),
         GREATEST(1, CEIL(COALESCE(h.avg_per_hour,0) * 300.0 / (3600.0 * 0.85))::int)
  FROM slots s
  CROSS JOIN channels c
  LEFT JOIN hist h ON h.h = EXTRACT(HOUR FROM s.ts)::int AND h.dow = EXTRACT(DOW FROM s.ts)::int AND h.ch = c.ch
  ORDER BY s.ts, c.ch;
$$;
GRANT EXECUTE ON FUNCTION public.ac_wfm_auto_forecast(int) TO authenticated;

CREATE OR REPLACE FUNCTION public.ac_journey_attribution(days_back int DEFAULT 30)
RETURNS TABLE(source text, first_touch int, last_touch int, linear_touch numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH conv AS (
    SELECT session_hash FROM ac_analytics_events
    WHERE created_at > now() - (days_back || ' days')::interval AND is_conversion = true
    GROUP BY session_hash
  ),
  touches AS (
    SELECT e.session_hash,
           COALESCE(NULLIF(e.utm_source, ''), NULLIF(e.referrer, ''), 'direct') AS src,
           ROW_NUMBER() OVER (PARTITION BY e.session_hash ORDER BY e.created_at ASC) AS rn_first,
           ROW_NUMBER() OVER (PARTITION BY e.session_hash ORDER BY e.created_at DESC) AS rn_last,
           COUNT(*) OVER (PARTITION BY e.session_hash) AS total
    FROM ac_analytics_events e JOIN conv c ON c.session_hash = e.session_hash
    WHERE e.created_at > now() - (days_back || ' days')::interval
  )
  SELECT src,
         SUM(CASE WHEN rn_first = 1 THEN 1 ELSE 0 END)::int,
         SUM(CASE WHEN rn_last = 1 THEN 1 ELSE 0 END)::int,
         ROUND(SUM(1.0 / NULLIF(total,0))::numeric, 2)
  FROM touches GROUP BY src ORDER BY 3 DESC;
$$;
GRANT EXECUTE ON FUNCTION public.ac_journey_attribution(int) TO authenticated;

CREATE OR REPLACE FUNCTION public.ac_journey_cohorts(weeks int DEFAULT 8)
RETURNS TABLE(cohort_week date, week_offset int, retained_visitors int, cohort_size int, retention_pct numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH first_seen AS (
    SELECT visitor_hash, date_trunc('week', MIN(created_at))::date AS cohort
    FROM ac_analytics_events
    WHERE visitor_hash IS NOT NULL AND created_at > now() - (weeks || ' weeks')::interval
    GROUP BY visitor_hash
  ),
  activity AS (
    SELECT f.cohort, f.visitor_hash,
           GREATEST(0, (date_trunc('week', e.created_at)::date - f.cohort) / 7) AS week_offset
    FROM first_seen f
    JOIN ac_analytics_events e ON e.visitor_hash = f.visitor_hash
    WHERE e.created_at > now() - (weeks || ' weeks')::interval
    GROUP BY f.cohort, f.visitor_hash, week_offset
  ),
  sizes AS (SELECT cohort, COUNT(DISTINCT visitor_hash)::int AS n FROM first_seen GROUP BY cohort)
  SELECT a.cohort, a.week_offset::int, COUNT(DISTINCT a.visitor_hash)::int, s.n,
         ROUND(100.0 * COUNT(DISTINCT a.visitor_hash) / NULLIF(s.n,0), 1)
  FROM activity a JOIN sizes s ON s.cohort = a.cohort
  GROUP BY a.cohort, a.week_offset, s.n ORDER BY a.cohort DESC, a.week_offset ASC;
$$;
GRANT EXECUTE ON FUNCTION public.ac_journey_cohorts(int) TO authenticated;

CREATE OR REPLACE FUNCTION public.ac_portal_deflection(days_back int DEFAULT 30)
RETURNS TABLE(total_sessions int, handoff_sessions int, deflected_sessions int, deflection_pct numeric, avg_messages numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH s AS (SELECT * FROM ac_portal_chat_sessions WHERE created_at > now() - (days_back || ' days')::interval)
  SELECT COUNT(*)::int,
         SUM(CASE WHEN ticket_id IS NOT NULL THEN 1 ELSE 0 END)::int,
         SUM(CASE WHEN ticket_id IS NULL AND jsonb_array_length(COALESCE(messages,'[]'::jsonb)) >= 2 THEN 1 ELSE 0 END)::int,
         ROUND(100.0 * SUM(CASE WHEN ticket_id IS NULL AND jsonb_array_length(COALESCE(messages,'[]'::jsonb)) >= 2 THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0), 1),
         ROUND(AVG(jsonb_array_length(COALESCE(messages,'[]'::jsonb)))::numeric, 1)
  FROM s;
$$;
GRANT EXECUTE ON FUNCTION public.ac_portal_deflection(int) TO authenticated;