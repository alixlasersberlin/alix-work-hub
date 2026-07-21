
CREATE TABLE IF NOT EXISTS public.alixdocs_share_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_link_id UUID NOT NULL REFERENCES public.alixdocs_share_links(id) ON DELETE CASCADE,
  document_id UUID REFERENCES public.alixdocs_documents(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('view','unlock','open','download','zip','page_view','dwell')),
  page_no INT,
  dwell_ms INT,
  ip_hash TEXT,
  user_agent TEXT,
  referer TEXT,
  country TEXT,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_alixdocs_share_events_link ON public.alixdocs_share_events(share_link_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alixdocs_share_events_doc ON public.alixdocs_share_events(document_id, created_at DESC);

GRANT SELECT ON public.alixdocs_share_events TO authenticated;
GRANT ALL ON public.alixdocs_share_events TO service_role;

ALTER TABLE public.alixdocs_share_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "alixdocs_share_events_admin_read" ON public.alixdocs_share_events
  FOR SELECT TO authenticated
  USING (has_role('Admin') OR has_role('Super Admin'));
