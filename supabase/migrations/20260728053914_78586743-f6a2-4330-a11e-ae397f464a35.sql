
CREATE TABLE IF NOT EXISTS public.social_oauth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.social_accounts(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  access_token_ct BYTEA NOT NULL,
  access_token_iv BYTEA NOT NULL,
  refresh_token_ct BYTEA,
  refresh_token_iv BYTEA,
  scopes TEXT[],
  expires_at TIMESTAMPTZ,
  external_user_id TEXT,
  external_account_id TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(account_id)
);
GRANT SELECT ON public.social_oauth_tokens TO authenticated;
GRANT ALL ON public.social_oauth_tokens TO service_role;
ALTER TABLE public.social_oauth_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "oauth_admin_read" ON public.social_oauth_tokens;
CREATE POLICY "oauth_admin_read" ON public.social_oauth_tokens FOR SELECT TO authenticated USING (public.can_admin_social());

CREATE TABLE IF NOT EXISTS public.social_campaign_posts (
  campaign_id UUID NOT NULL REFERENCES public.social_campaigns(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (campaign_id, post_id)
);
GRANT SELECT ON public.social_campaign_posts TO authenticated;
GRANT ALL ON public.social_campaign_posts TO service_role;
ALTER TABLE public.social_campaign_posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cpost_read" ON public.social_campaign_posts;
DROP POLICY IF EXISTS "cpost_write" ON public.social_campaign_posts;
CREATE POLICY "cpost_read" ON public.social_campaign_posts FOR SELECT TO authenticated USING (public.can_manage_social());
CREATE POLICY "cpost_write" ON public.social_campaign_posts FOR ALL TO authenticated USING (public.can_admin_social()) WITH CHECK (public.can_admin_social());

CREATE TABLE IF NOT EXISTS public.social_ads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.social_campaigns(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  external_ad_id TEXT,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  spend NUMERIC(12,2) DEFAULT 0,
  impressions BIGINT DEFAULT 0,
  clicks BIGINT DEFAULT 0,
  conversions BIGINT DEFAULT 0,
  ctr NUMERIC(6,3) DEFAULT 0,
  cpc NUMERIC(10,4) DEFAULT 0,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.social_ads TO authenticated;
GRANT ALL ON public.social_ads TO service_role;
ALTER TABLE public.social_ads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ads_read" ON public.social_ads;
DROP POLICY IF EXISTS "ads_write" ON public.social_ads;
CREATE POLICY "ads_read" ON public.social_ads FOR SELECT TO authenticated USING (public.can_manage_social());
CREATE POLICY "ads_write" ON public.social_ads FOR ALL TO authenticated USING (public.can_admin_social()) WITH CHECK (public.can_admin_social());

CREATE TABLE IF NOT EXISTS public.social_competitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.social_clients(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  handle TEXT NOT NULL,
  display_name TEXT,
  notes TEXT,
  last_snapshot_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(client_id, platform, handle)
);
GRANT SELECT ON public.social_competitors TO authenticated;
GRANT ALL ON public.social_competitors TO service_role;
ALTER TABLE public.social_competitors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "comp_read" ON public.social_competitors;
DROP POLICY IF EXISTS "comp_write" ON public.social_competitors;
CREATE POLICY "comp_read" ON public.social_competitors FOR SELECT TO authenticated USING (public.can_manage_social());
CREATE POLICY "comp_write" ON public.social_competitors FOR ALL TO authenticated USING (public.can_admin_social()) WITH CHECK (public.can_admin_social());

CREATE TABLE IF NOT EXISTS public.social_competitor_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id UUID NOT NULL REFERENCES public.social_competitors(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  followers BIGINT DEFAULT 0,
  posts_count BIGINT DEFAULT 0,
  avg_engagement_rate NUMERIC(6,3) DEFAULT 0,
  top_hashtags TEXT[],
  raw JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(competitor_id, snapshot_date)
);
GRANT SELECT ON public.social_competitor_snapshots TO authenticated;
GRANT ALL ON public.social_competitor_snapshots TO service_role;
ALTER TABLE public.social_competitor_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "compsnap_read" ON public.social_competitor_snapshots;
DROP POLICY IF EXISTS "compsnap_write" ON public.social_competitor_snapshots;
CREATE POLICY "compsnap_read" ON public.social_competitor_snapshots FOR SELECT TO authenticated USING (public.can_manage_social());
CREATE POLICY "compsnap_write" ON public.social_competitor_snapshots FOR ALL TO authenticated USING (public.can_admin_social()) WITH CHECK (public.can_admin_social());

CREATE TABLE IF NOT EXISTS public.social_hashtag_research (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.social_clients(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  hashtag TEXT NOT NULL,
  volume BIGINT DEFAULT 0,
  difficulty NUMERIC(5,2) DEFAULT 0,
  trend TEXT,
  suggested_best_time TIMESTAMPTZ,
  ai_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.social_hashtag_research TO authenticated;
GRANT ALL ON public.social_hashtag_research TO service_role;
ALTER TABLE public.social_hashtag_research ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "hash_read" ON public.social_hashtag_research;
DROP POLICY IF EXISTS "hash_write" ON public.social_hashtag_research;
CREATE POLICY "hash_read" ON public.social_hashtag_research FOR SELECT TO authenticated USING (public.can_manage_social());
CREATE POLICY "hash_write" ON public.social_hashtag_research FOR ALL TO authenticated USING (public.can_admin_social()) WITH CHECK (public.can_admin_social());

CREATE TABLE IF NOT EXISTS public.social_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.social_clients(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  pdf_path TEXT,
  summary JSONB,
  generated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.social_reports TO authenticated;
GRANT ALL ON public.social_reports TO service_role;
ALTER TABLE public.social_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rep_read" ON public.social_reports;
DROP POLICY IF EXISTS "rep_write" ON public.social_reports;
CREATE POLICY "rep_read" ON public.social_reports FOR SELECT TO authenticated USING (public.can_manage_social());
CREATE POLICY "rep_write" ON public.social_reports FOR ALL TO authenticated USING (public.can_admin_social()) WITH CHECK (public.can_admin_social());

CREATE TABLE IF NOT EXISTS public.social_portal_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.social_clients(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ,
  disabled_at TIMESTAMPTZ,
  last_viewed_at TIMESTAMPTZ,
  view_count INTEGER NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.social_portal_links TO authenticated;
GRANT ALL ON public.social_portal_links TO service_role;
ALTER TABLE public.social_portal_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "portal_read" ON public.social_portal_links;
DROP POLICY IF EXISTS "portal_write" ON public.social_portal_links;
CREATE POLICY "portal_read" ON public.social_portal_links FOR SELECT TO authenticated USING (public.can_manage_social());
CREATE POLICY "portal_write" ON public.social_portal_links FOR ALL TO authenticated USING (public.can_admin_social()) WITH CHECK (public.can_admin_social());

DROP TRIGGER IF EXISTS trg_soauth_touch ON public.social_oauth_tokens;
CREATE TRIGGER trg_soauth_touch BEFORE UPDATE ON public.social_oauth_tokens FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_sads_touch ON public.social_ads;
CREATE TRIGGER trg_sads_touch BEFORE UPDATE ON public.social_ads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_scomp_touch ON public.social_competitors;
CREATE TRIGGER trg_scomp_touch BEFORE UPDATE ON public.social_competitors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_sads_camp ON public.social_ads(campaign_id);
CREATE INDEX IF NOT EXISTS idx_scomp_client ON public.social_competitors(client_id);
CREATE INDEX IF NOT EXISTS idx_scompsnap_comp_date ON public.social_competitor_snapshots(competitor_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_shash_client ON public.social_hashtag_research(client_id, platform);
CREATE INDEX IF NOT EXISTS idx_srep_client ON public.social_reports(client_id, period_start DESC);
