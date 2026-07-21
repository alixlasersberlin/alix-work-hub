
ALTER TABLE public.ac_kb_articles
  ADD COLUMN IF NOT EXISTS visible_segment_ids uuid[] DEFAULT '{}'::uuid[],
  ADD COLUMN IF NOT EXISTS auto_publish_threshold numeric;

CREATE TABLE IF NOT EXISTS public.ac_kb_article_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES public.ac_kb_articles(id) ON DELETE CASCADE,
  version integer NOT NULL,
  title text,
  content text,
  category text,
  tags text[] DEFAULT '{}'::text[],
  changed_by uuid,
  change_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.ac_kb_article_versions TO authenticated;
GRANT ALL ON public.ac_kb_article_versions TO service_role;
ALTER TABLE public.ac_kb_article_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kb_versions_admin_read" ON public.ac_kb_article_versions
  FOR SELECT TO authenticated
  USING (
    public.has_role('Super Admin')
    OR public.has_role('Admin')
    OR changed_by = auth.uid()
  );
CREATE POLICY "kb_versions_insert" ON public.ac_kb_article_versions
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role('Super Admin') OR public.has_role('Admin')
  );

CREATE INDEX IF NOT EXISTS idx_kb_versions_article ON public.ac_kb_article_versions(article_id, version DESC);

CREATE OR REPLACE FUNCTION public.ac_kb_snapshot_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (OLD.title IS DISTINCT FROM NEW.title) OR (OLD.content IS DISTINCT FROM NEW.content) OR (OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO public.ac_kb_article_versions(article_id, version, title, content, category, tags, changed_by)
    VALUES (OLD.id, COALESCE(OLD.version, 1), OLD.title, OLD.content, OLD.category, OLD.tags, auth.uid());
    NEW.version = COALESCE(OLD.version, 1) + 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ac_kb_snapshot_version ON public.ac_kb_articles;
CREATE TRIGGER trg_ac_kb_snapshot_version
  BEFORE UPDATE ON public.ac_kb_articles
  FOR EACH ROW EXECUTE FUNCTION public.ac_kb_snapshot_version();

ALTER TABLE public.ac_wfm_shifts
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approval_note text;

ALTER TABLE public.ac_journey_segments
  ADD COLUMN IF NOT EXISTS auto_enroll_journey_id uuid REFERENCES public.ac_journeys(id) ON DELETE SET NULL;

ALTER TABLE public.ac_portal_chat_sessions
  ADD COLUMN IF NOT EXISTS video_callback_requested boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS video_callback_at timestamptz,
  ADD COLUMN IF NOT EXISTS csat_rating integer CHECK (csat_rating BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS csat_comment text,
  ADD COLUMN IF NOT EXISTS csat_at timestamptz;

CREATE OR REPLACE FUNCTION public.ac_portal_deflection_breakdown(_from timestamptz, _to timestamptz)
RETURNS TABLE(bucket text, sessions bigint, handoffs bigint, deflection_rate numeric, avg_csat numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(s.handoff_channel, 'self_service') AS bucket,
    COUNT(*)::bigint AS sessions,
    COUNT(*) FILTER (WHERE s.handoff_requested)::bigint AS handoffs,
    ROUND(100.0 * COUNT(*) FILTER (WHERE NOT s.handoff_requested) / NULLIF(COUNT(*),0), 1) AS deflection_rate,
    ROUND(AVG(s.csat_rating)::numeric, 2) AS avg_csat
  FROM public.ac_portal_chat_sessions s
  WHERE s.created_at BETWEEN _from AND _to
  GROUP BY 1
  ORDER BY sessions DESC;
$$;
GRANT EXECUTE ON FUNCTION public.ac_portal_deflection_breakdown(timestamptz, timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION public.ac_journey_attribution_ext(_from timestamptz, _to timestamptz, _model text DEFAULT 'linear')
RETURNS TABLE(channel text, conversions numeric)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH touches AS (
    SELECT
      e.visitor_hash,
      e.utm_source AS channel,
      e.created_at,
      row_number() OVER (PARTITION BY e.visitor_hash ORDER BY e.created_at) AS rn,
      count(*) OVER (PARTITION BY e.visitor_hash) AS n,
      max(e.created_at) OVER (PARTITION BY e.visitor_hash) AS conv_at
    FROM public.ac_analytics_events e
    WHERE e.created_at BETWEEN _from AND _to
      AND e.utm_source IS NOT NULL
  ),
  weighted AS (
    SELECT
      channel,
      CASE _model
        WHEN 'first' THEN CASE WHEN rn = 1 THEN 1.0 ELSE 0 END
        WHEN 'last'  THEN CASE WHEN rn = n THEN 1.0 ELSE 0 END
        WHEN 'linear' THEN 1.0 / n
        WHEN 'time_decay' THEN power(2, -extract(epoch FROM (conv_at - created_at))/604800.0) / NULLIF(sum(power(2, -extract(epoch FROM (conv_at - created_at))/604800.0)) OVER (PARTITION BY visitor_hash), 0)
        WHEN 'position' THEN CASE
          WHEN n = 1 THEN 1.0
          WHEN rn = 1 OR rn = n THEN 0.4
          ELSE 0.2 / GREATEST(n - 2, 1)
        END
        ELSE 1.0 / n
      END AS w
    FROM touches
  )
  SELECT w.channel, ROUND(SUM(w.w)::numeric, 2) AS conversions
  FROM weighted w
  GROUP BY w.channel
  ORDER BY conversions DESC NULLS LAST;
END;
$$;
GRANT EXECUTE ON FUNCTION public.ac_journey_attribution_ext(timestamptz, timestamptz, text) TO authenticated;
