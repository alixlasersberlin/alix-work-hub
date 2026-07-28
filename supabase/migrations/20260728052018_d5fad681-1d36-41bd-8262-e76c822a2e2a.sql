
CREATE TABLE IF NOT EXISTS public.social_post_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.social_clients(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  metric_date DATE NOT NULL DEFAULT CURRENT_DATE,
  impressions INTEGER NOT NULL DEFAULT 0,
  reach INTEGER NOT NULL DEFAULT 0,
  likes INTEGER NOT NULL DEFAULT 0,
  comments INTEGER NOT NULL DEFAULT 0,
  shares INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  saves INTEGER NOT NULL DEFAULT 0,
  engagement_rate NUMERIC(6,4) NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'manual',
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (post_id, metric_date)
);
CREATE INDEX IF NOT EXISTS idx_spm_client_date ON public.social_post_metrics(client_id, metric_date DESC);
CREATE INDEX IF NOT EXISTS idx_spm_platform_date ON public.social_post_metrics(platform, metric_date DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_post_metrics TO authenticated;
GRANT ALL ON public.social_post_metrics TO service_role;
ALTER TABLE public.social_post_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "spm_read_social_team" ON public.social_post_metrics;
CREATE POLICY "spm_read_social_team" ON public.social_post_metrics
  FOR SELECT TO authenticated USING (
    public.has_role('Super Admin')
    OR public.has_role('Admin')
    OR public.has_role('Marketing')
    OR public.has_role('Grafiker')
  );
DROP POLICY IF EXISTS "spm_write_social_manage" ON public.social_post_metrics;
CREATE POLICY "spm_write_social_manage" ON public.social_post_metrics
  FOR ALL TO authenticated USING (public.can_admin_social()) WITH CHECK (public.can_admin_social());

CREATE TABLE IF NOT EXISTS public.social_publish_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.social_clients(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  scheduled_for TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  external_post_id TEXT,
  external_url TEXT,
  last_error TEXT,
  requested_by UUID,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_spj_status_time ON public.social_publish_jobs(status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_spj_post ON public.social_publish_jobs(post_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_publish_jobs TO authenticated;
GRANT ALL ON public.social_publish_jobs TO service_role;
ALTER TABLE public.social_publish_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "spj_read_social_team" ON public.social_publish_jobs;
CREATE POLICY "spj_read_social_team" ON public.social_publish_jobs
  FOR SELECT TO authenticated USING (
    public.has_role('Super Admin')
    OR public.has_role('Admin')
    OR public.has_role('Marketing')
    OR public.has_role('Grafiker')
  );
DROP POLICY IF EXISTS "spj_write_social_manage" ON public.social_publish_jobs;
CREATE POLICY "spj_write_social_manage" ON public.social_publish_jobs
  FOR ALL TO authenticated USING (public.can_admin_social()) WITH CHECK (public.can_admin_social());

CREATE OR REPLACE FUNCTION public.social_touch_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_spm_touch ON public.social_post_metrics;
CREATE TRIGGER trg_spm_touch BEFORE UPDATE ON public.social_post_metrics
  FOR EACH ROW EXECUTE FUNCTION public.social_touch_updated_at();

DROP TRIGGER IF EXISTS trg_spj_touch ON public.social_publish_jobs;
CREATE TRIGGER trg_spj_touch BEFORE UPDATE ON public.social_publish_jobs
  FOR EACH ROW EXECUTE FUNCTION public.social_touch_updated_at();
