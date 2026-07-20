
-- ===== Phase 16: Experiments =====
CREATE TABLE IF NOT EXISTS public.ac_web_experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES public.ac_websites(id) ON DELETE CASCADE,
  tenant_id UUID,
  name TEXT NOT NULL,
  description TEXT,
  variants JSONB NOT NULL DEFAULT '[{"key":"A","weight":50},{"key":"B","weight":50}]'::jsonb,
  goal_event TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ac_web_experiments TO authenticated;
GRANT SELECT ON public.ac_web_experiments TO anon; -- tracker needs variant definition
GRANT ALL ON public.ac_web_experiments TO service_role;
ALTER TABLE public.ac_web_experiments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage experiments" ON public.ac_web_experiments FOR ALL TO authenticated
  USING (has_role('Admin') OR has_role('Super Admin'))
  WITH CHECK (has_role('Admin') OR has_role('Super Admin'));
CREATE POLICY "Authenticated read experiments" ON public.ac_web_experiments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anon read active experiments" ON public.ac_web_experiments FOR SELECT TO anon USING (is_active = true);
CREATE INDEX IF NOT EXISTS idx_ac_web_experiments_website ON public.ac_web_experiments(website_id);

-- ===== Phase 17: Segments =====
CREATE TABLE IF NOT EXISTS public.ac_web_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES public.ac_websites(id) ON DELETE CASCADE,
  tenant_id UUID,
  name TEXT NOT NULL,
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ac_web_segments TO authenticated;
GRANT ALL ON public.ac_web_segments TO service_role;
ALTER TABLE public.ac_web_segments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage segments" ON public.ac_web_segments FOR ALL TO authenticated
  USING (has_role('Admin') OR has_role('Super Admin'))
  WITH CHECK (has_role('Admin') OR has_role('Super Admin'));
CREATE POLICY "Authenticated read segments" ON public.ac_web_segments FOR SELECT TO authenticated USING (true);
CREATE INDEX IF NOT EXISTS idx_ac_web_segments_website ON public.ac_web_segments(website_id);

CREATE OR REPLACE FUNCTION public.trg_ac_web_touch()
RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS ac_web_exp_touch ON public.ac_web_experiments;
CREATE TRIGGER ac_web_exp_touch BEFORE UPDATE ON public.ac_web_experiments FOR EACH ROW EXECUTE FUNCTION public.trg_ac_web_touch();
DROP TRIGGER IF EXISTS ac_web_seg_touch ON public.ac_web_segments;
CREATE TRIGGER ac_web_seg_touch BEFORE UPDATE ON public.ac_web_segments FOR EACH ROW EXECUTE FUNCTION public.trg_ac_web_touch();

-- ===== Phase 15: Sessions =====
CREATE OR REPLACE FUNCTION public.ac_web_sessions(_website_id UUID, _from TIMESTAMPTZ, _to TIMESTAMPTZ, _limit INT DEFAULT 50)
RETURNS TABLE(session_hash TEXT, visitor_hash TEXT, started_at TIMESTAMPTZ, last_seen TIMESTAMPTZ,
              pageviews BIGINT, events BIGINT, country TEXT, device_type TEXT, browser TEXT,
              entry_url TEXT, referrer TEXT)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT
    session_hash,
    MAX(visitor_hash) AS visitor_hash,
    MIN(created_at) AS started_at,
    MAX(created_at) AS last_seen,
    COUNT(*) FILTER (WHERE event_type = 'pageview')::BIGINT AS pageviews,
    COUNT(*)::BIGINT AS events,
    (ARRAY_AGG(country) FILTER (WHERE country IS NOT NULL))[1] AS country,
    (ARRAY_AGG(device_type) FILTER (WHERE device_type IS NOT NULL))[1] AS device_type,
    (ARRAY_AGG(browser) FILTER (WHERE browser IS NOT NULL))[1] AS browser,
    (ARRAY_AGG(page_url ORDER BY created_at))[1] AS entry_url,
    (ARRAY_AGG(referrer) FILTER (WHERE referrer IS NOT NULL))[1] AS referrer
  FROM public.ac_analytics_events
  WHERE website_id = _website_id AND is_bot = false
    AND created_at >= _from AND created_at < _to
    AND session_hash IS NOT NULL
  GROUP BY session_hash
  ORDER BY MAX(created_at) DESC
  LIMIT COALESCE(_limit, 50);
$$;
REVOKE ALL ON FUNCTION public.ac_web_sessions(UUID, TIMESTAMPTZ, TIMESTAMPTZ, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ac_web_sessions(UUID, TIMESTAMPTZ, TIMESTAMPTZ, INT) TO authenticated;

CREATE OR REPLACE FUNCTION public.ac_web_session_events(_session_hash TEXT)
RETURNS TABLE(created_at TIMESTAMPTZ, event_type TEXT, page_url TEXT, page_title TEXT,
              scroll_depth INT, duration_ms INT, metadata JSONB)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT created_at, event_type, page_url, page_title, scroll_depth, duration_ms, metadata
  FROM public.ac_analytics_events
  WHERE session_hash = _session_hash
  ORDER BY created_at ASC
  LIMIT 500;
$$;
REVOKE ALL ON FUNCTION public.ac_web_session_events(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ac_web_session_events(TEXT) TO authenticated;

-- ===== Phase 16: Experiment stats =====
CREATE OR REPLACE FUNCTION public.ac_web_experiment_stats(_experiment_id UUID, _from TIMESTAMPTZ, _to TIMESTAMPTZ)
RETURNS TABLE(variant TEXT, exposures BIGINT, conversions BIGINT, conversion_pct NUMERIC)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ex RECORD;
BEGIN
  SELECT * INTO ex FROM public.ac_web_experiments WHERE id = _experiment_id;
  IF NOT FOUND THEN RETURN; END IF;
  RETURN QUERY
  WITH exp AS (
    SELECT visitor_hash, (metadata->>'variant') AS variant, MIN(created_at) AS first_seen
    FROM public.ac_analytics_events
    WHERE website_id = ex.website_id AND is_bot = false
      AND event_type = 'experiment_exposure'
      AND (metadata->>'experiment') = ex.name
      AND created_at >= _from AND created_at < _to
    GROUP BY visitor_hash, metadata->>'variant'
  ),
  conv AS (
    SELECT DISTINCT e.variant, ev.visitor_hash
    FROM exp e
    JOIN public.ac_analytics_events ev
      ON ev.visitor_hash = e.visitor_hash
     AND ev.website_id = ex.website_id
     AND ev.created_at >= e.first_seen AND ev.created_at < _to
     AND (ex.goal_event IS NULL OR ev.event_type = ex.goal_event)
    WHERE ex.goal_event IS NOT NULL
  )
  SELECT
    e.variant,
    COUNT(DISTINCT e.visitor_hash)::BIGINT AS exposures,
    COUNT(DISTINCT c.visitor_hash)::BIGINT AS conversions,
    CASE WHEN COUNT(DISTINCT e.visitor_hash) = 0 THEN 0
         ELSE ROUND((COUNT(DISTINCT c.visitor_hash)::NUMERIC / COUNT(DISTINCT e.visitor_hash)) * 100, 2)
    END AS conversion_pct
  FROM exp e LEFT JOIN conv c ON c.variant = e.variant
  GROUP BY e.variant ORDER BY e.variant;
END;
$$;
REVOKE ALL ON FUNCTION public.ac_web_experiment_stats(UUID, TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ac_web_experiment_stats(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

-- ===== Phase 17: Segment stats =====
-- filters JSONB e.g. {"country":"DE","device_type":"mobile","utm_source":"google","page_ilike":"/produkt"}
CREATE OR REPLACE FUNCTION public.ac_web_segment_stats(_website_id UUID, _filters JSONB, _from TIMESTAMPTZ, _to TIMESTAMPTZ)
RETURNS TABLE(visitors BIGINT, sessions BIGINT, pageviews BIGINT, conversions BIGINT)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT
    COUNT(DISTINCT visitor_hash)::BIGINT AS visitors,
    COUNT(DISTINCT session_hash)::BIGINT AS sessions,
    COUNT(*) FILTER (WHERE event_type = 'pageview')::BIGINT AS pageviews,
    COUNT(*) FILTER (WHERE is_conversion = true)::BIGINT AS conversions
  FROM public.ac_analytics_events
  WHERE website_id = _website_id
    AND is_bot = false
    AND created_at >= _from AND created_at < _to
    AND ( (_filters->>'country') IS NULL OR country = (_filters->>'country') )
    AND ( (_filters->>'device_type') IS NULL OR device_type = (_filters->>'device_type') )
    AND ( (_filters->>'browser') IS NULL OR browser = (_filters->>'browser') )
    AND ( (_filters->>'utm_source') IS NULL OR utm_source = (_filters->>'utm_source') )
    AND ( (_filters->>'utm_medium') IS NULL OR utm_medium = (_filters->>'utm_medium') )
    AND ( (_filters->>'utm_campaign') IS NULL OR utm_campaign = (_filters->>'utm_campaign') )
    AND ( (_filters->>'page_ilike') IS NULL OR page_url ILIKE '%' || (_filters->>'page_ilike') || '%' );
$$;
REVOKE ALL ON FUNCTION public.ac_web_segment_stats(UUID, JSONB, TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ac_web_segment_stats(UUID, JSONB, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

-- ===== Phase 18: Live map =====
CREATE OR REPLACE FUNCTION public.ac_web_live_map(_website_id UUID)
RETURNS TABLE(country TEXT, visitors BIGINT, last_seen TIMESTAMPTZ)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(country, 'XX') AS country,
         COUNT(DISTINCT visitor_hash)::BIGINT AS visitors,
         MAX(created_at) AS last_seen
  FROM public.ac_analytics_events
  WHERE website_id = _website_id
    AND is_bot = false
    AND created_at >= now() - interval '5 minutes'
  GROUP BY COALESCE(country, 'XX')
  ORDER BY visitors DESC;
$$;
REVOKE ALL ON FUNCTION public.ac_web_live_map(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ac_web_live_map(UUID) TO authenticated;
