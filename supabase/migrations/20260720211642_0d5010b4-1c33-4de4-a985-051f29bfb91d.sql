
CREATE TABLE IF NOT EXISTS public.ac_web_funnels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES public.ac_websites(id) ON DELETE CASCADE,
  tenant_id UUID,
  name TEXT NOT NULL,
  description TEXT,
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  window_hours INT NOT NULL DEFAULT 24,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ac_web_funnels TO authenticated;
GRANT ALL ON public.ac_web_funnels TO service_role;

ALTER TABLE public.ac_web_funnels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage funnels"
  ON public.ac_web_funnels
  FOR ALL
  TO authenticated
  USING (has_role('Admin') OR has_role('Super Admin'))
  WITH CHECK (has_role('Admin') OR has_role('Super Admin'));

CREATE POLICY "Authenticated read funnels"
  ON public.ac_web_funnels
  FOR SELECT
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_ac_web_funnels_website ON public.ac_web_funnels(website_id);

CREATE OR REPLACE FUNCTION public.trg_ac_web_funnels_updated()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS ac_web_funnels_updated ON public.ac_web_funnels;
CREATE TRIGGER ac_web_funnels_updated BEFORE UPDATE ON public.ac_web_funnels
FOR EACH ROW EXECUTE FUNCTION public.trg_ac_web_funnels_updated();

CREATE OR REPLACE FUNCTION public.ac_web_funnel_stats(_funnel_id UUID, _from TIMESTAMPTZ, _to TIMESTAMPTZ)
RETURNS TABLE(step_index INT, step_label TEXT, visitors BIGINT, conversion_pct NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  f RECORD;
  step JSONB;
  idx INT := 0;
  step_kind TEXT;
  step_match TEXT;
  s_label TEXT;
  cur_visitors_text TEXT[];
  prev_visitors_text TEXT[];
  first_count BIGINT := 0;
  cur_count BIGINT;
BEGIN
  SELECT * INTO f FROM public.ac_web_funnels WHERE id = _funnel_id;
  IF NOT FOUND THEN RETURN; END IF;

  prev_visitors_text := ARRAY[]::TEXT[];

  FOR step IN SELECT * FROM jsonb_array_elements(f.steps)
  LOOP
    step_kind := COALESCE(step->>'kind', 'pageview');
    step_match := COALESCE(step->>'match', '');
    s_label := COALESCE(step->>'label', step_kind || ':' || step_match);

    IF idx = 0 THEN
      SELECT COALESCE(array_agg(DISTINCT visitor_hash), ARRAY[]::TEXT[])
        INTO cur_visitors_text
        FROM public.ac_analytics_events
       WHERE website_id = f.website_id
         AND is_bot = false
         AND created_at >= _from AND created_at < _to
         AND (
           (step_kind = 'pageview' AND event_type = 'pageview' AND (step_match = '' OR page_url ILIKE '%' || step_match || '%'))
           OR (step_kind = 'event' AND event_type = step_match)
           OR (step_kind = 'scroll' AND event_type = 'scroll_depth' AND scroll_depth >= NULLIF(step_match,'')::INT)
         );
      first_count := COALESCE(array_length(cur_visitors_text, 1), 0);
      cur_count := first_count;
    ELSE
      SELECT COALESCE(array_agg(DISTINCT visitor_hash), ARRAY[]::TEXT[])
        INTO cur_visitors_text
        FROM public.ac_analytics_events
       WHERE website_id = f.website_id
         AND is_bot = false
         AND created_at >= _from AND created_at < _to
         AND visitor_hash = ANY(prev_visitors_text)
         AND (
           (step_kind = 'pageview' AND event_type = 'pageview' AND (step_match = '' OR page_url ILIKE '%' || step_match || '%'))
           OR (step_kind = 'event' AND event_type = step_match)
           OR (step_kind = 'scroll' AND event_type = 'scroll_depth' AND scroll_depth >= NULLIF(step_match,'')::INT)
         );
      cur_count := COALESCE(array_length(cur_visitors_text, 1), 0);
    END IF;

    step_index := idx;
    step_label := s_label;
    visitors := cur_count;
    conversion_pct := CASE WHEN first_count = 0 THEN 0 ELSE ROUND((cur_count::NUMERIC / first_count) * 100, 2) END;
    RETURN NEXT;

    prev_visitors_text := cur_visitors_text;
    idx := idx + 1;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.ac_web_funnel_stats(UUID, TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ac_web_funnel_stats(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

CREATE OR REPLACE FUNCTION public.ac_web_click_heatmap(_website_id UUID, _page TEXT, _from TIMESTAMPTZ, _to TIMESTAMPTZ)
RETURNS TABLE(x_pct INT, y_pct INT, hits BIGINT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ((metadata->>'x_pct')::INT / 2) * 2 AS x_pct,
    ((metadata->>'y_pct')::INT / 2) * 2 AS y_pct,
    COUNT(*)::BIGINT AS hits
  FROM public.ac_analytics_events
  WHERE website_id = _website_id
    AND event_type = 'click'
    AND is_bot = false
    AND created_at >= _from AND created_at < _to
    AND (_page IS NULL OR _page = '' OR page_url ILIKE '%' || _page || '%')
    AND metadata ? 'x_pct' AND metadata ? 'y_pct'
  GROUP BY 1, 2
  ORDER BY 3 DESC
  LIMIT 5000;
$$;

REVOKE ALL ON FUNCTION public.ac_web_click_heatmap(UUID, TEXT, TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ac_web_click_heatmap(UUID, TEXT, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

CREATE OR REPLACE FUNCTION public.ac_web_click_pages(_website_id UUID, _from TIMESTAMPTZ, _to TIMESTAMPTZ)
RETURNS TABLE(page_url TEXT, clicks BIGINT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT page_url, COUNT(*)::BIGINT AS clicks
  FROM public.ac_analytics_events
  WHERE website_id = _website_id
    AND event_type = 'click'
    AND is_bot = false
    AND page_url IS NOT NULL
    AND created_at >= _from AND created_at < _to
  GROUP BY page_url
  ORDER BY clicks DESC
  LIMIT 50;
$$;

REVOKE ALL ON FUNCTION public.ac_web_click_pages(UUID, TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ac_web_click_pages(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
