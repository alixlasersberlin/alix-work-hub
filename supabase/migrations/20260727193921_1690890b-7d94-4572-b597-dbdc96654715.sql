-- ALIX Audit Center — Phase 1 Fundament (uses text-based has_role)

CREATE TABLE public.audit_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  user_email TEXT,
  session_token TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  last_heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  active_seconds INT NOT NULL DEFAULT 0,
  idle_seconds INT NOT NULL DEFAULT 0,
  click_count INT NOT NULL DEFAULT 0,
  scroll_count INT NOT NULL DEFAULT 0,
  keystroke_count INT NOT NULL DEFAULT 0,
  device_id TEXT,
  ip_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_sessions_user ON public.audit_sessions(user_id, started_at DESC);
CREATE INDEX idx_audit_sessions_open ON public.audit_sessions(ended_at) WHERE ended_at IS NULL;
GRANT SELECT ON public.audit_sessions TO authenticated;
GRANT ALL ON public.audit_sessions TO service_role;
ALTER TABLE public.audit_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_sessions super admin read" ON public.audit_sessions FOR SELECT TO authenticated USING (public.has_role('Super Admin'));
CREATE POLICY "audit_sessions service write" ON public.audit_sessions FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE public.audit_devices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  session_id UUID REFERENCES public.audit_sessions(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  user_agent TEXT, browser TEXT, browser_version TEXT,
  os TEXT, os_version TEXT,
  screen_resolution TEXT, language TEXT, timezone TEXT, is_mobile BOOLEAN,
  cookie_id TEXT,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_devices_user ON public.audit_devices(user_id);
CREATE INDEX idx_audit_devices_device ON public.audit_devices(device_id);
GRANT SELECT ON public.audit_devices TO authenticated;
GRANT ALL ON public.audit_devices TO service_role;
ALTER TABLE public.audit_devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_devices super admin read" ON public.audit_devices FOR SELECT TO authenticated USING (public.has_role('Super Admin'));
CREATE POLICY "audit_devices service write" ON public.audit_devices FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE public.audit_geo (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES public.audit_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  ipv4 TEXT, ipv6 TEXT, asn TEXT, provider TEXT,
  country TEXT, region TEXT, city TEXT,
  latitude NUMERIC(9,6), longitude NUMERIC(9,6),
  vpn_detected BOOLEAN DEFAULT false,
  proxy_detected BOOLEAN DEFAULT false,
  tor_detected BOOLEAN DEFAULT false,
  gps_latitude NUMERIC(9,6), gps_longitude NUMERIC(9,6),
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_geo_session ON public.audit_geo(session_id);
CREATE INDEX idx_audit_geo_user ON public.audit_geo(user_id, captured_at DESC);
GRANT SELECT ON public.audit_geo TO authenticated;
GRANT ALL ON public.audit_geo TO service_role;
ALTER TABLE public.audit_geo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_geo super admin read" ON public.audit_geo FOR SELECT TO authenticated USING (public.has_role('Super Admin'));
CREATE POLICY "audit_geo service write" ON public.audit_geo FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE public.audit_actions (
  id BIGSERIAL PRIMARY KEY,
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id UUID NOT NULL,
  session_id UUID,
  module TEXT NOT NULL,
  action TEXT NOT NULL,
  object_type TEXT, object_id TEXT,
  duration_ms INT, path TEXT,
  meta JSONB DEFAULT '{}'::jsonb
);
CREATE INDEX idx_audit_actions_user_ts ON public.audit_actions(user_id, ts DESC);
CREATE INDEX idx_audit_actions_module_ts ON public.audit_actions(module, ts DESC);
CREATE INDEX idx_audit_actions_object ON public.audit_actions(object_type, object_id);
CREATE INDEX idx_audit_actions_ts ON public.audit_actions(ts DESC);
GRANT SELECT ON public.audit_actions TO authenticated;
GRANT ALL ON public.audit_actions TO service_role;
ALTER TABLE public.audit_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_actions super admin read" ON public.audit_actions FOR SELECT TO authenticated USING (public.has_role('Super Admin'));
CREATE POLICY "audit_actions service write" ON public.audit_actions FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE public.audit_changes (
  id BIGSERIAL PRIMARY KEY,
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id UUID,
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  field_name TEXT NOT NULL,
  old_value TEXT, new_value TEXT,
  operation TEXT NOT NULL DEFAULT 'update',
  meta JSONB DEFAULT '{}'::jsonb
);
CREATE INDEX idx_audit_changes_user_ts ON public.audit_changes(user_id, ts DESC);
CREATE INDEX idx_audit_changes_record ON public.audit_changes(table_name, record_id);
CREATE INDEX idx_audit_changes_ts ON public.audit_changes(ts DESC);
GRANT SELECT ON public.audit_changes TO authenticated;
GRANT ALL ON public.audit_changes TO service_role;
ALTER TABLE public.audit_changes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_changes super admin read" ON public.audit_changes FOR SELECT TO authenticated USING (public.has_role('Super Admin'));
CREATE POLICY "audit_changes service write" ON public.audit_changes FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE public.audit_access_log (
  id BIGSERIAL PRIMARY KEY,
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  viewer_id UUID NOT NULL,
  viewer_email TEXT,
  section TEXT NOT NULL,
  target_user_id UUID,
  filter JSONB DEFAULT '{}'::jsonb,
  ip_hash TEXT
);
CREATE INDEX idx_audit_access_log_ts ON public.audit_access_log(ts DESC);
CREATE INDEX idx_audit_access_log_viewer ON public.audit_access_log(viewer_id, ts DESC);
GRANT SELECT, INSERT ON public.audit_access_log TO authenticated;
GRANT ALL ON public.audit_access_log TO service_role;
ALTER TABLE public.audit_access_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_access_log super admin read" ON public.audit_access_log FOR SELECT TO authenticated USING (public.has_role('Super Admin'));
CREATE POLICY "audit_access_log super admin insert" ON public.audit_access_log FOR INSERT TO authenticated WITH CHECK (public.has_role('Super Admin') AND viewer_id = auth.uid());
CREATE POLICY "audit_access_log service write" ON public.audit_access_log FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.touch_audit_sessions_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER trg_audit_sessions_touch BEFORE UPDATE ON public.audit_sessions
  FOR EACH ROW EXECUTE FUNCTION public.touch_audit_sessions_updated_at();