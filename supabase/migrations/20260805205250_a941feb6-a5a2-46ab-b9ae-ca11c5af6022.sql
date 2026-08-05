CREATE TABLE IF NOT EXISTS public.page_usage_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  path text NOT NULL,
  label text,
  workspace_code text,
  hits integer NOT NULL DEFAULT 1,
  last_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, path)
);

GRANT SELECT, INSERT, UPDATE ON public.page_usage_stats TO authenticated;
GRANT ALL ON public.page_usage_stats TO service_role;

ALTER TABLE public.page_usage_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "page_usage_own_select" ON public.page_usage_stats
  FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()) OR public.has_role('Super Admin') OR public.has_role('Admin'));

CREATE POLICY "page_usage_own_insert" ON public.page_usage_stats
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "page_usage_own_update" ON public.page_usage_stats
  FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE INDEX IF NOT EXISTS idx_page_usage_user_hits ON public.page_usage_stats (user_id, hits DESC);

CREATE OR REPLACE FUNCTION public.page_usage_track(_path text, _label text DEFAULT NULL, _workspace_code text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR _path IS NULL OR _path = '' THEN RETURN; END IF;
  INSERT INTO public.page_usage_stats (user_id, path, label, workspace_code)
  VALUES (auth.uid(), _path, _label, _workspace_code)
  ON CONFLICT (user_id, path) DO UPDATE
    SET hits = public.page_usage_stats.hits + 1,
        last_at = now(),
        label = COALESCE(EXCLUDED.label, public.page_usage_stats.label),
        workspace_code = COALESCE(EXCLUDED.workspace_code, public.page_usage_stats.workspace_code);
END;
$$;

CREATE OR REPLACE FUNCTION public.page_usage_top(_limit integer DEFAULT 20)
RETURNS TABLE (path text, label text, workspace_code text, hits integer, last_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.path, p.label, p.workspace_code, p.hits, p.last_at
  FROM public.page_usage_stats p
  WHERE p.user_id = auth.uid()
  ORDER BY p.hits DESC, p.last_at DESC
  LIMIT COALESCE(_limit, 20);
$$;