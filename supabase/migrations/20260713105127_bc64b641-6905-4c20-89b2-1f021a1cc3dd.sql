ALTER TABLE public.catalog_share_links
  ADD COLUMN IF NOT EXISTS password_hash text,
  ADD COLUMN IF NOT EXISTS max_views integer;

CREATE TABLE IF NOT EXISTS public.catalog_share_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id uuid NOT NULL REFERENCES public.catalog_share_links(id) ON DELETE CASCADE,
  accessed_at timestamptz NOT NULL DEFAULT now(),
  ip_hash text,
  user_agent text,
  outcome text NOT NULL DEFAULT 'ok'
);

CREATE INDEX IF NOT EXISTS idx_catalog_share_access_log_link
  ON public.catalog_share_access_log(link_id, accessed_at DESC);

GRANT SELECT ON public.catalog_share_access_log TO authenticated;
GRANT ALL ON public.catalog_share_access_log TO service_role;

ALTER TABLE public.catalog_share_access_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Katalog liest Zugriffs-Log" ON public.catalog_share_access_log;
CREATE POLICY "Katalog liest Zugriffs-Log"
  ON public.catalog_share_access_log FOR SELECT TO authenticated
  USING (
    public.has_role('Super Admin')
    OR public.has_role('Admin')
    OR public.has_role('Katalog')
  );