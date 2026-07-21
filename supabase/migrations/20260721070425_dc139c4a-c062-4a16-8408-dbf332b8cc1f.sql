CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE public.ac_wfm_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  forecast_date DATE NOT NULL,
  channel TEXT NOT NULL,
  interval_start TIMESTAMPTZ NOT NULL,
  predicted_volume INTEGER NOT NULL DEFAULT 0,
  predicted_aht_sec INTEGER NOT NULL DEFAULT 0,
  required_agents INTEGER NOT NULL DEFAULT 0,
  actual_volume INTEGER,
  actual_aht_sec INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ac_wfm_forecasts TO authenticated;
GRANT ALL ON public.ac_wfm_forecasts TO service_role;
ALTER TABLE public.ac_wfm_forecasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wfm_forecasts_admin_qm" ON public.ac_wfm_forecasts FOR ALL TO authenticated
  USING (has_role('Super Admin') OR has_role('Admin') OR has_role('QM'))
  WITH CHECK (has_role('Super Admin') OR has_role('Admin') OR has_role('QM'));

CREATE TABLE public.ac_wfm_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  shift_start TIMESTAMPTZ NOT NULL,
  shift_end TIMESTAMPTZ NOT NULL,
  shift_type TEXT NOT NULL DEFAULT 'regular',
  status TEXT NOT NULL DEFAULT 'scheduled',
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ac_wfm_shifts TO authenticated;
GRANT ALL ON public.ac_wfm_shifts TO service_role;
ALTER TABLE public.ac_wfm_shifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wfm_shifts_read_own_or_admin" ON public.ac_wfm_shifts FOR SELECT TO authenticated
  USING (agent_id = auth.uid() OR has_role('Super Admin') OR has_role('Admin') OR has_role('QM'));
CREATE POLICY "wfm_shifts_write_admin" ON public.ac_wfm_shifts FOR ALL TO authenticated
  USING (has_role('Super Admin') OR has_role('Admin') OR has_role('QM'))
  WITH CHECK (has_role('Super Admin') OR has_role('Admin') OR has_role('QM'));

CREATE TABLE public.ac_wfm_adherence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  shift_id UUID REFERENCES public.ac_wfm_shifts(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  event_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  duration_sec INTEGER,
  meta JSONB DEFAULT '{}'::jsonb
);
GRANT SELECT, INSERT ON public.ac_wfm_adherence TO authenticated;
GRANT ALL ON public.ac_wfm_adherence TO service_role;
ALTER TABLE public.ac_wfm_adherence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wfm_adherence_read" ON public.ac_wfm_adherence FOR SELECT TO authenticated
  USING (agent_id = auth.uid() OR has_role('Super Admin') OR has_role('Admin') OR has_role('QM'));
CREATE POLICY "wfm_adherence_write_self" ON public.ac_wfm_adherence FOR INSERT TO authenticated
  WITH CHECK (agent_id = auth.uid() OR has_role('Super Admin') OR has_role('Admin'));

CREATE TABLE public.ac_kb_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT,
  tags TEXT[] DEFAULT '{}',
  language TEXT NOT NULL DEFAULT 'de',
  status TEXT NOT NULL DEFAULT 'draft',
  version INTEGER NOT NULL DEFAULT 1,
  public_visible BOOLEAN NOT NULL DEFAULT false,
  embedding vector(1536),
  author_id UUID,
  view_count INTEGER NOT NULL DEFAULT 0,
  helpful_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ac_kb_articles TO authenticated;
GRANT SELECT ON public.ac_kb_articles TO anon;
GRANT ALL ON public.ac_kb_articles TO service_role;
ALTER TABLE public.ac_kb_articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kb_read_published_public" ON public.ac_kb_articles FOR SELECT TO anon
  USING (status = 'published' AND public_visible = true);
CREATE POLICY "kb_read_all_auth" ON public.ac_kb_articles FOR SELECT TO authenticated USING (true);
CREATE POLICY "kb_write_admin_qm" ON public.ac_kb_articles FOR ALL TO authenticated
  USING (has_role('Super Admin') OR has_role('Admin') OR has_role('QM'))
  WITH CHECK (has_role('Super Admin') OR has_role('Admin') OR has_role('QM'));

CREATE INDEX ac_kb_articles_embedding_idx ON public.ac_kb_articles USING hnsw (embedding vector_cosine_ops);
CREATE INDEX ac_kb_articles_status_idx ON public.ac_kb_articles(status, public_visible);

CREATE OR REPLACE FUNCTION public.ac_kb_search(query_embedding vector(1536), match_count int DEFAULT 5, only_public boolean DEFAULT false)
RETURNS TABLE (id UUID, title TEXT, content TEXT, category TEXT, similarity float)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.id, a.title, a.content, a.category, 1 - (a.embedding <=> query_embedding) as similarity
  FROM public.ac_kb_articles a
  WHERE a.embedding IS NOT NULL AND a.status = 'published'
    AND (NOT only_public OR a.public_visible = true)
  ORDER BY a.embedding <=> query_embedding
  LIMIT match_count;
$$;

CREATE TABLE public.ac_portal_chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_token TEXT NOT NULL UNIQUE,
  customer_id UUID,
  contact_email TEXT,
  contact_phone TEXT,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  handoff_requested BOOLEAN NOT NULL DEFAULT false,
  handoff_channel TEXT,
  conversation_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.ac_portal_chat_sessions TO anon, authenticated;
GRANT ALL ON public.ac_portal_chat_sessions TO service_role;
ALTER TABLE public.ac_portal_chat_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "portal_chat_admin_read" ON public.ac_portal_chat_sessions FOR SELECT TO authenticated
  USING (has_role('Super Admin') OR has_role('Admin'));

CREATE OR REPLACE FUNCTION public.ac_journey_funnel(days_back int DEFAULT 30)
RETURNS TABLE (stage TEXT, count BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT event_type as stage, COUNT(*) as count
  FROM public.ac_analytics_events
  WHERE created_at >= now() - (days_back || ' days')::interval
  GROUP BY event_type ORDER BY count DESC LIMIT 20;
$$;

CREATE OR REPLACE FUNCTION public.update_ac_p25_updated_at() RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER trg_ac_wfm_shifts_updated BEFORE UPDATE ON public.ac_wfm_shifts FOR EACH ROW EXECUTE FUNCTION public.update_ac_p25_updated_at();
CREATE TRIGGER trg_ac_kb_articles_updated BEFORE UPDATE ON public.ac_kb_articles FOR EACH ROW EXECUTE FUNCTION public.update_ac_p25_updated_at();
CREATE TRIGGER trg_ac_portal_chat_updated BEFORE UPDATE ON public.ac_portal_chat_sessions FOR EACH ROW EXECUTE FUNCTION public.update_ac_p25_updated_at();