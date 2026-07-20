
ALTER TABLE public.ac_analytics_events
  ADD COLUMN IF NOT EXISTS is_conversion boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS goal_id uuid,
  ADD COLUMN IF NOT EXISTS conversion_value_cents integer;

CREATE INDEX IF NOT EXISTS idx_ac_events_goal
  ON public.ac_analytics_events(website_id, goal_id)
  WHERE is_conversion = true;

CREATE TABLE IF NOT EXISTS public.ac_web_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id uuid NOT NULL REFERENCES public.ac_websites(id) ON DELETE CASCADE,
  tenant_id uuid,
  name text NOT NULL,
  description text,
  goal_type text NOT NULL CHECK (goal_type IN ('pageview','event','duration','scroll','outbound')),
  match_mode text NOT NULL DEFAULT 'contains' CHECK (match_mode IN ('equals','contains','starts_with','regex')),
  match_pattern text,
  event_name text,
  threshold_value integer,
  value_cents integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ac_web_goals_site ON public.ac_web_goals(website_id) WHERE is_active;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ac_web_goals TO authenticated;
GRANT ALL ON public.ac_web_goals TO service_role;

ALTER TABLE public.ac_web_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ac_web_goals_select" ON public.ac_web_goals FOR SELECT TO authenticated
USING (
  public.has_role('Super Admin')
  OR EXISTS (
    SELECT 1 FROM public.ac_websites w
    WHERE w.id = ac_web_goals.website_id
      AND (w.tenant_id IS NULL OR EXISTS (
        SELECT 1 FROM public.user_tenant_access uta
        WHERE uta.user_id = auth.uid() AND uta.tenant_id = w.tenant_id
      ))
  )
);

CREATE POLICY "ac_web_goals_write" ON public.ac_web_goals FOR ALL TO authenticated
USING (public.has_role('Super Admin') OR public.has_role('Admin'))
WITH CHECK (public.has_role('Super Admin') OR public.has_role('Admin'));

CREATE OR REPLACE FUNCTION public.trg_ac_web_goals_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_ac_web_goals_touch ON public.ac_web_goals;
CREATE TRIGGER trg_ac_web_goals_touch
BEFORE UPDATE ON public.ac_web_goals
FOR EACH ROW EXECUTE FUNCTION public.trg_ac_web_goals_touch();

CREATE OR REPLACE FUNCTION public.trg_ac_events_match_goal()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE g record;
BEGIN
  IF NEW.is_bot THEN RETURN NEW; END IF;
  IF NEW.is_conversion THEN RETURN NEW; END IF;

  FOR g IN
    SELECT * FROM public.ac_web_goals
    WHERE website_id = NEW.website_id AND is_active = true
    ORDER BY value_cents DESC, created_at ASC
  LOOP
    IF g.goal_type = 'pageview' AND NEW.event_type = 'pageview' AND g.match_pattern IS NOT NULL THEN
      IF (g.match_mode = 'equals'      AND NEW.page_url = g.match_pattern)
      OR (g.match_mode = 'contains'    AND NEW.page_url ILIKE '%' || g.match_pattern || '%')
      OR (g.match_mode = 'starts_with' AND NEW.page_url ILIKE g.match_pattern || '%')
      OR (g.match_mode = 'regex'       AND NEW.page_url ~ g.match_pattern) THEN
        NEW.is_conversion := true; NEW.goal_id := g.id; NEW.conversion_value_cents := g.value_cents; EXIT;
      END IF;

    ELSIF g.goal_type = 'event' AND NEW.event_type = COALESCE(g.event_name,'') THEN
      NEW.is_conversion := true; NEW.goal_id := g.id; NEW.conversion_value_cents := g.value_cents; EXIT;

    ELSIF g.goal_type = 'outbound' AND NEW.event_type = 'outbound' THEN
      IF g.match_pattern IS NULL
         OR NEW.page_url ILIKE '%' || g.match_pattern || '%'
         OR COALESCE(NEW.metadata->>'href','') ILIKE '%' || g.match_pattern || '%' THEN
        NEW.is_conversion := true; NEW.goal_id := g.id; NEW.conversion_value_cents := g.value_cents; EXIT;
      END IF;

    ELSIF g.goal_type = 'scroll' AND NEW.event_type = 'scroll'
          AND g.threshold_value IS NOT NULL
          AND COALESCE(NEW.scroll_depth,0) >= g.threshold_value THEN
      NEW.is_conversion := true; NEW.goal_id := g.id; NEW.conversion_value_cents := g.value_cents; EXIT;

    ELSIF g.goal_type = 'duration' AND g.threshold_value IS NOT NULL
          AND COALESCE(NEW.duration_ms,0) >= g.threshold_value * 1000 THEN
      NEW.is_conversion := true; NEW.goal_id := g.id; NEW.conversion_value_cents := g.value_cents; EXIT;
    END IF;
  END LOOP;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_ac_events_match_goal ON public.ac_analytics_events;
CREATE TRIGGER trg_ac_events_match_goal
BEFORE INSERT ON public.ac_analytics_events
FOR EACH ROW EXECUTE FUNCTION public.trg_ac_events_match_goal();

CREATE OR REPLACE FUNCTION public.ac_web_goals_summary(
  _website_id uuid, _from timestamptz, _to timestamptz
)
RETURNS TABLE (
  goal_id uuid, name text, goal_type text, conversions bigint,
  unique_visitors bigint, revenue_cents bigint, conversion_rate numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH sessions AS (
    SELECT COUNT(DISTINCT session_hash) AS total_sessions
    FROM public.ac_analytics_events
    WHERE website_id = _website_id
      AND created_at BETWEEN _from AND _to
      AND is_bot = false
      AND event_type = 'pageview'
  )
  SELECT
    g.id, g.name, g.goal_type,
    COUNT(e.id)::bigint AS conversions,
    COUNT(DISTINCT e.visitor_hash)::bigint AS unique_visitors,
    COALESCE(SUM(e.conversion_value_cents),0)::bigint AS revenue_cents,
    CASE WHEN (SELECT total_sessions FROM sessions) > 0
         THEN ROUND(100.0 * COUNT(DISTINCT e.session_hash) / (SELECT total_sessions FROM sessions), 2)
         ELSE 0 END AS conversion_rate
  FROM public.ac_web_goals g
  LEFT JOIN public.ac_analytics_events e
    ON e.goal_id = g.id AND e.created_at BETWEEN _from AND _to
  WHERE g.website_id = _website_id
  GROUP BY g.id, g.name, g.goal_type
  ORDER BY conversions DESC, g.created_at ASC;
$$;

GRANT EXECUTE ON FUNCTION public.ac_web_goals_summary(uuid, timestamptz, timestamptz) TO authenticated;
