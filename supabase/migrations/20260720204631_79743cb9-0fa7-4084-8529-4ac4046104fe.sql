
-- 1) Auto-generate public api_key for new websites
CREATE OR REPLACE FUNCTION public.ac_websites_ensure_api_key()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.api_key IS NULL OR length(NEW.api_key) = 0 THEN
    NEW.api_key := 'pub_' || replace(replace(replace(encode(gen_random_bytes(24), 'base64'), '/', ''), '+', ''), '=', '');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ac_websites_api_key ON public.ac_websites;
CREATE TRIGGER trg_ac_websites_api_key
BEFORE INSERT ON public.ac_websites
FOR EACH ROW EXECUTE FUNCTION public.ac_websites_ensure_api_key();

-- Backfill any existing NULL keys
UPDATE public.ac_websites
SET api_key = 'pub_' || replace(replace(replace(encode(gen_random_bytes(24), 'base64'), '/', ''), '+', ''), '=', '')
WHERE api_key IS NULL OR length(api_key) = 0;

-- Helpful indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_ac_events_website_time ON public.ac_analytics_events (website_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ac_events_visitor_time ON public.ac_analytics_events (website_id, visitor_hash, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ac_websites_api_key ON public.ac_websites (api_key);

-- 2) RPC: live counters (online, today, yesterday, week, month, year)
CREATE OR REPLACE FUNCTION public.ac_web_live(_website_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tenant uuid;
  _res jsonb;
BEGIN
  SELECT tenant_id INTO _tenant FROM public.ac_websites WHERE id = _website_id;
  IF _tenant IS NULL THEN
    RAISE EXCEPTION 'website not found';
  END IF;

  IF NOT (
    public.has_role('Super Admin') OR public.has_role('Admin')
    OR EXISTS (SELECT 1 FROM public.user_tenant_access WHERE user_id = auth.uid() AND tenant_id = _tenant)
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT jsonb_build_object(
    'online_now', (
      SELECT count(DISTINCT visitor_hash) FROM public.ac_analytics_events
      WHERE website_id = _website_id AND created_at >= now() - interval '5 minutes' AND is_bot IS NOT TRUE
    ),
    'today', (
      SELECT count(DISTINCT visitor_hash) FROM public.ac_analytics_events
      WHERE website_id = _website_id AND created_at >= date_trunc('day', now()) AND event_type = 'pageview' AND is_bot IS NOT TRUE
    ),
    'yesterday', (
      SELECT count(DISTINCT visitor_hash) FROM public.ac_analytics_events
      WHERE website_id = _website_id
        AND created_at >= date_trunc('day', now()) - interval '1 day'
        AND created_at <  date_trunc('day', now())
        AND event_type = 'pageview' AND is_bot IS NOT TRUE
    ),
    'week', (
      SELECT count(DISTINCT visitor_hash) FROM public.ac_analytics_events
      WHERE website_id = _website_id AND created_at >= date_trunc('week', now()) AND event_type = 'pageview' AND is_bot IS NOT TRUE
    ),
    'month', (
      SELECT count(DISTINCT visitor_hash) FROM public.ac_analytics_events
      WHERE website_id = _website_id AND created_at >= date_trunc('month', now()) AND event_type = 'pageview' AND is_bot IS NOT TRUE
    ),
    'year', (
      SELECT count(DISTINCT visitor_hash) FROM public.ac_analytics_events
      WHERE website_id = _website_id AND created_at >= date_trunc('year', now()) AND event_type = 'pageview' AND is_bot IS NOT TRUE
    ),
    'pageviews_today', (
      SELECT count(*) FROM public.ac_analytics_events
      WHERE website_id = _website_id AND created_at >= date_trunc('day', now()) AND event_type = 'pageview' AND is_bot IS NOT TRUE
    )
  ) INTO _res;
  RETURN _res;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ac_web_live(uuid) TO authenticated;

-- 3) RPC: top pages
CREATE OR REPLACE FUNCTION public.ac_web_top_pages(_website_id uuid, _from timestamptz, _to timestamptz, _limit int DEFAULT 20)
RETURNS TABLE(page_url text, views bigint, uniques bigint)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tenant uuid;
BEGIN
  SELECT tenant_id INTO _tenant FROM public.ac_websites WHERE id = _website_id;
  IF _tenant IS NULL THEN RAISE EXCEPTION 'website not found'; END IF;
  IF NOT (public.has_role('Super Admin') OR public.has_role('Admin')
    OR EXISTS (SELECT 1 FROM public.user_tenant_access WHERE user_id = auth.uid() AND tenant_id = _tenant))
  THEN RAISE EXCEPTION 'forbidden'; END IF;

  RETURN QUERY
  SELECT e.page_url, count(*)::bigint AS views, count(DISTINCT e.visitor_hash)::bigint AS uniques
  FROM public.ac_analytics_events e
  WHERE e.website_id = _website_id
    AND e.event_type = 'pageview' AND e.is_bot IS NOT TRUE
    AND e.created_at >= _from AND e.created_at < _to
  GROUP BY e.page_url
  ORDER BY views DESC
  LIMIT _limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ac_web_top_pages(uuid, timestamptz, timestamptz, int) TO authenticated;

-- 4) RPC: top referrers / UTM breakdown
CREATE OR REPLACE FUNCTION public.ac_web_breakdown(_website_id uuid, _from timestamptz, _to timestamptz, _dim text)
RETURNS TABLE(label text, views bigint, uniques bigint)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tenant uuid;
BEGIN
  SELECT tenant_id INTO _tenant FROM public.ac_websites WHERE id = _website_id;
  IF _tenant IS NULL THEN RAISE EXCEPTION 'website not found'; END IF;
  IF NOT (public.has_role('Super Admin') OR public.has_role('Admin')
    OR EXISTS (SELECT 1 FROM public.user_tenant_access WHERE user_id = auth.uid() AND tenant_id = _tenant))
  THEN RAISE EXCEPTION 'forbidden'; END IF;

  RETURN QUERY
  SELECT
    COALESCE(NULLIF(
      CASE _dim
        WHEN 'referrer'    THEN e.referrer
        WHEN 'utm_source'  THEN e.utm_source
        WHEN 'utm_medium'  THEN e.utm_medium
        WHEN 'utm_campaign' THEN e.utm_campaign
        WHEN 'country'     THEN e.country
        WHEN 'device'      THEN e.device_type
        WHEN 'browser'     THEN e.browser
        WHEN 'os'          THEN e.os
        WHEN 'language'    THEN e.language
        ELSE NULL
      END, ''), '(direct)') AS label,
    count(*)::bigint AS views,
    count(DISTINCT e.visitor_hash)::bigint AS uniques
  FROM public.ac_analytics_events e
  WHERE e.website_id = _website_id
    AND e.event_type = 'pageview' AND e.is_bot IS NOT TRUE
    AND e.created_at >= _from AND e.created_at < _to
  GROUP BY 1
  ORDER BY views DESC
  LIMIT 25;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ac_web_breakdown(uuid, timestamptz, timestamptz, text) TO authenticated;

-- 5) RPC: daily series
CREATE OR REPLACE FUNCTION public.ac_web_daily_series(_website_id uuid, _from timestamptz, _to timestamptz)
RETURNS TABLE(day date, views bigint, uniques bigint)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tenant uuid;
BEGIN
  SELECT tenant_id INTO _tenant FROM public.ac_websites WHERE id = _website_id;
  IF _tenant IS NULL THEN RAISE EXCEPTION 'website not found'; END IF;
  IF NOT (public.has_role('Super Admin') OR public.has_role('Admin')
    OR EXISTS (SELECT 1 FROM public.user_tenant_access WHERE user_id = auth.uid() AND tenant_id = _tenant))
  THEN RAISE EXCEPTION 'forbidden'; END IF;

  RETURN QUERY
  SELECT (date_trunc('day', e.created_at))::date AS day,
         count(*)::bigint AS views,
         count(DISTINCT e.visitor_hash)::bigint AS uniques
  FROM public.ac_analytics_events e
  WHERE e.website_id = _website_id
    AND e.event_type = 'pageview' AND e.is_bot IS NOT TRUE
    AND e.created_at >= _from AND e.created_at < _to
  GROUP BY 1
  ORDER BY 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ac_web_daily_series(uuid, timestamptz, timestamptz) TO authenticated;

-- 6) Enable realtime for the events (used by admin live-feed)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'ac_analytics_events'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.ac_analytics_events';
  END IF;
END $$;
