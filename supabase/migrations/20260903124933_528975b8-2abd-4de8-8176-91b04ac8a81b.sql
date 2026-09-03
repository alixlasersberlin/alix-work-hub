-- =====================================================================
-- ALIXWORK MOBILE – PROMPT 9: GO-LIVE / ROLLOUT / MONITORING
-- Additiv. Keine bestehenden Tabellen/Policies verändert.
-- =====================================================================

-- ------------------------------------------------------------ RELEASES
CREATE TABLE IF NOT EXISTS public.app_releases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT NOT NULL,
  build_number TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'ALL',
  release_channel TEXT NOT NULL DEFAULT 'RC',
  status TEXT NOT NULL DEFAULT 'DRAFT',
  stability TEXT NOT NULL DEFAULT 'OBSERVATION',
  summary TEXT,
  changes JSONB,
  known_issues JSONB,
  rollback_plan TEXT,
  commit_ref TEXT,
  released_by_user_id UUID,
  released_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_app_releases_version_build
  ON public.app_releases (version, build_number, platform);

GRANT SELECT ON public.app_releases TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.app_releases TO authenticated;
GRANT ALL ON public.app_releases TO service_role;
ALTER TABLE public.app_releases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "releases_read_auth" ON public.app_releases
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "releases_admin_write" ON public.app_releases
  FOR ALL TO authenticated
  USING (public.has_role('Super Admin') OR public.has_role('Admin'))
  WITH CHECK (public.has_role('Super Admin') OR public.has_role('Admin'));

-- ------------------------------------------------------ ROLLOUT GROUPS
CREATE TABLE IF NOT EXISTS public.mobile_rollout_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  stage INTEGER NOT NULL DEFAULT 1,
  feature_keys JSONB,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mobile_rollout_groups TO authenticated;
GRANT ALL ON public.mobile_rollout_groups TO service_role;
ALTER TABLE public.mobile_rollout_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rollout_groups_read_auth" ON public.mobile_rollout_groups
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "rollout_groups_admin_write" ON public.mobile_rollout_groups
  FOR ALL TO authenticated
  USING (public.has_role('Super Admin') OR public.has_role('Admin'))
  WITH CHECK (public.has_role('Super Admin') OR public.has_role('Admin'));

CREATE TABLE IF NOT EXISTS public.mobile_rollout_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.mobile_rollout_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_rollout_users_user ON public.mobile_rollout_users (user_id) WHERE enabled;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mobile_rollout_users TO authenticated;
GRANT ALL ON public.mobile_rollout_users TO service_role;
ALTER TABLE public.mobile_rollout_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rollout_users_read_own_or_admin" ON public.mobile_rollout_users
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role('Super Admin') OR public.has_role('Admin'));
CREATE POLICY "rollout_users_admin_write" ON public.mobile_rollout_users
  FOR ALL TO authenticated
  USING (public.has_role('Super Admin') OR public.has_role('Admin'))
  WITH CHECK (public.has_role('Super Admin') OR public.has_role('Admin'));

INSERT INTO public.mobile_rollout_groups (name, description, stage, is_active)
VALUES
  ('DEVELOPERS',    'Entwicklung und Super Admin – Stage 1', 1, true),
  ('TECHNIK_PILOT', 'Technik-Pilot (Inbox, Push, Tickets, Technik-KI) – Stage 2', 2, false),
  ('SALES_PILOT',   'Sales-Pilot (Inbox, Quick Replies, Kunden 360) – Stage 3', 3, false),
  ('ADMIN_PILOT',   'Administrative Pilotnutzer – Stage 4', 4, false),
  ('FULL_INTERNAL', 'Vollständiger interner Rollout – Stage 7', 7, false)
ON CONFLICT (name) DO NOTHING;

-- --------------------------------------------------- INTEGRATION HEALTH
CREATE TABLE IF NOT EXISTS public.integration_health (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'UNKNOWN',
  last_success_at TIMESTAMPTZ,
  last_failure_at TIMESTAMPTZ,
  last_error_code TEXT,
  last_error_summary TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.integration_health TO authenticated;
GRANT ALL ON public.integration_health TO service_role;
ALTER TABLE public.integration_health ENABLE ROW LEVEL SECURITY;

CREATE POLICY "integration_health_read_auth" ON public.integration_health
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "integration_health_admin_write" ON public.integration_health
  FOR ALL TO authenticated
  USING (public.has_role('Super Admin') OR public.has_role('Admin'))
  WITH CHECK (public.has_role('Super Admin') OR public.has_role('Admin'));
GRANT INSERT, UPDATE ON public.integration_health TO authenticated;

-- ----------------------------------------------------------- INCIDENTS
CREATE TABLE IF NOT EXISTS public.mobile_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  severity TEXT NOT NULL DEFAULT 'ERROR',
  component TEXT NOT NULL,
  error_code TEXT NOT NULL DEFAULT 'UNKNOWN',
  summary TEXT NOT NULL,
  release_version TEXT,
  customer_impact TEXT NOT NULL DEFAULT 'UNKNOWN',
  user_id UUID,
  device_id UUID,
  conversation_id UUID,
  ticket_id UUID,
  status TEXT NOT NULL DEFAULT 'OPEN',
  occurrence_count INTEGER NOT NULL DEFAULT 1,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  metadata JSONB
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_mobile_incident_group
  ON public.mobile_incidents (component, error_code, COALESCE(release_version, '-'))
  WHERE status IN ('OPEN', 'INVESTIGATING');
CREATE INDEX IF NOT EXISTS idx_mobile_incidents_last_seen ON public.mobile_incidents (last_seen_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.mobile_incidents TO authenticated;
GRANT ALL ON public.mobile_incidents TO service_role;
ALTER TABLE public.mobile_incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "incidents_admin_read" ON public.mobile_incidents
  FOR SELECT TO authenticated
  USING (public.has_role('Super Admin') OR public.has_role('Admin') OR public.is_mobile_supervisor());
CREATE POLICY "incidents_admin_write" ON public.mobile_incidents
  FOR ALL TO authenticated
  USING (public.has_role('Super Admin') OR public.has_role('Admin'))
  WITH CHECK (public.has_role('Super Admin') OR public.has_role('Admin'));

-- ------------------------------------------------------------ FEEDBACK
CREATE TABLE IF NOT EXISTS public.mobile_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid(),
  category TEXT NOT NULL DEFAULT 'UX',
  message TEXT NOT NULL,
  screen TEXT,
  app_version TEXT,
  device_info JSONB,
  status TEXT NOT NULL DEFAULT 'NEW',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mobile_feedback_created ON public.mobile_feedback (created_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.mobile_feedback TO authenticated;
GRANT ALL ON public.mobile_feedback TO service_role;
ALTER TABLE public.mobile_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feedback_insert_own" ON public.mobile_feedback
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "feedback_read_own_or_admin" ON public.mobile_feedback
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role('Super Admin') OR public.has_role('Admin'));
CREATE POLICY "feedback_admin_update" ON public.mobile_feedback
  FOR UPDATE TO authenticated
  USING (public.has_role('Super Admin') OR public.has_role('Admin'))
  WITH CHECK (public.has_role('Super Admin') OR public.has_role('Admin'));

-- -------------------------------------------------------- APP CONFIG
CREATE TABLE IF NOT EXISTS public.mobile_app_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment TEXT NOT NULL UNIQUE,
  minimum_supported_version TEXT NOT NULL DEFAULT '1.0.0',
  recommended_version TEXT NOT NULL DEFAULT '1.0.0',
  rollout_stage INTEGER NOT NULL DEFAULT 1,
  maintenance_mode BOOLEAN NOT NULL DEFAULT false,
  maintenance_message TEXT,
  mobile_read_only BOOLEAN NOT NULL DEFAULT false,
  mobile_access_enabled BOOLEAN NOT NULL DEFAULT true,
  restrict_to_rollout_groups BOOLEAN NOT NULL DEFAULT true,
  whatsapp_outbound_enabled BOOLEAN NOT NULL DEFAULT false,
  push_enabled BOOLEAN NOT NULL DEFAULT true,
  ai_enabled BOOLEAN NOT NULL DEFAULT true,
  ticket_creation_enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);
GRANT SELECT, INSERT, UPDATE ON public.mobile_app_config TO authenticated;
GRANT ALL ON public.mobile_app_config TO service_role;
ALTER TABLE public.mobile_app_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "app_config_read_auth" ON public.mobile_app_config
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "app_config_admin_write" ON public.mobile_app_config
  FOR ALL TO authenticated
  USING (public.has_role('Super Admin') OR public.has_role('Admin'))
  WITH CHECK (public.has_role('Super Admin') OR public.has_role('Admin'));

INSERT INTO public.mobile_app_config (environment) VALUES ('DEVELOPMENT'), ('STAGING'), ('PRODUCTION')
ON CONFLICT (environment) DO NOTHING;

-- --------------------------------------------------- CONFIG AUDIT LOG
CREATE TABLE IF NOT EXISTS public.mobile_config_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment TEXT,
  field TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  changed_by UUID,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.mobile_config_audit TO authenticated;
GRANT ALL ON public.mobile_config_audit TO service_role;
ALTER TABLE public.mobile_config_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "config_audit_admin_read" ON public.mobile_config_audit
  FOR SELECT TO authenticated
  USING (public.has_role('Super Admin') OR public.has_role('Admin'));

CREATE OR REPLACE FUNCTION public.log_mobile_config_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  f TEXT;
  ov TEXT;
  nv TEXT;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'minimum_supported_version','recommended_version','rollout_stage','maintenance_mode',
    'maintenance_message','mobile_read_only','mobile_access_enabled','restrict_to_rollout_groups',
    'whatsapp_outbound_enabled','push_enabled','ai_enabled','ticket_creation_enabled'
  ] LOOP
    EXECUTE format('SELECT ($1).%I::text, ($2).%I::text', f, f) INTO ov, nv USING OLD, NEW;
    IF ov IS DISTINCT FROM nv THEN
      INSERT INTO public.mobile_config_audit (environment, field, old_value, new_value, changed_by)
      VALUES (NEW.environment, f, ov, nv, auth.uid());
    END IF;
  END LOOP;
  NEW.updated_at := now();
  NEW.updated_by := COALESCE(auth.uid(), NEW.updated_by);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mobile_config_audit ON public.mobile_app_config;
CREATE TRIGGER trg_mobile_config_audit
  BEFORE UPDATE ON public.mobile_app_config
  FOR EACH ROW EXECUTE FUNCTION public.log_mobile_config_change();

-- =====================================================================
-- SERVERSEITIGER ZUGRIFFS- UND BETRIEBSZUSTAND
-- =====================================================================
CREATE OR REPLACE FUNCTION public.mobile_access_state(p_environment TEXT DEFAULT 'PRODUCTION', p_app_version TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cfg public.mobile_app_config%ROWTYPE;
  v_admin BOOLEAN;
  v_in_group BOOLEAN;
  v_groups TEXT[];
  v_active BOOLEAN;
  v_update TEXT := 'NONE';
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'NOT_AUTHENTICATED');
  END IF;

  SELECT * INTO cfg FROM public.mobile_app_config WHERE environment = p_environment;
  IF NOT FOUND THEN
    SELECT * INTO cfg FROM public.mobile_app_config WHERE environment = 'PRODUCTION';
  END IF;

  v_admin := public.has_role('Super Admin') OR public.has_role('Admin');

  SELECT COALESCE(array_agg(g.name), ARRAY[]::TEXT[]),
         bool_or(g.is_active AND u.enabled)
    INTO v_groups, v_in_group
  FROM public.mobile_rollout_users u
  JOIN public.mobile_rollout_groups g ON g.id = u.group_id
  WHERE u.user_id = auth.uid();

  v_in_group := COALESCE(v_in_group, false);

  SELECT COALESCE(up.is_active, true) INTO v_active
  FROM public.user_profiles up WHERE up.id = auth.uid();
  v_active := COALESCE(v_active, true);

  IF p_app_version IS NOT NULL THEN
    IF string_to_array(p_app_version, '.')::int[] < string_to_array(cfg.minimum_supported_version, '.')::int[] THEN
      v_update := 'HARD';
    ELSIF string_to_array(p_app_version, '.')::int[] < string_to_array(cfg.recommended_version, '.')::int[] THEN
      v_update := 'SOFT';
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'allowed', CASE
      WHEN NOT v_active THEN false
      WHEN NOT cfg.mobile_access_enabled AND NOT v_admin THEN false
      WHEN cfg.restrict_to_rollout_groups AND NOT v_in_group AND NOT v_admin THEN false
      ELSE true END,
    'reason', CASE
      WHEN NOT v_active THEN 'USER_INACTIVE'
      WHEN NOT cfg.mobile_access_enabled AND NOT v_admin THEN 'MOBILE_ACCESS_OFF'
      WHEN cfg.restrict_to_rollout_groups AND NOT v_in_group AND NOT v_admin THEN 'NOT_IN_PILOT'
      ELSE 'OK' END,
    'environment', cfg.environment,
    'is_admin', v_admin,
    'groups', to_jsonb(COALESCE(v_groups, ARRAY[]::TEXT[])),
    'rollout_stage', cfg.rollout_stage,
    'maintenance_mode', cfg.maintenance_mode,
    'maintenance_message', cfg.maintenance_message,
    'read_only', cfg.mobile_read_only OR cfg.maintenance_mode,
    'whatsapp_outbound_enabled', cfg.whatsapp_outbound_enabled,
    'push_enabled', cfg.push_enabled,
    'ai_enabled', cfg.ai_enabled,
    'ticket_creation_enabled', cfg.ticket_creation_enabled,
    'minimum_supported_version', cfg.minimum_supported_version,
    'recommended_version', cfg.recommended_version,
    'update_required', v_update
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.mobile_access_state(TEXT, TEXT) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.mobile_access_state(TEXT, TEXT) TO authenticated, service_role;

-- =====================================================================
-- STÖRUNG MELDEN (gruppiert, kein Alert-Flood)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.mobile_report_incident(
  p_component TEXT, p_error_code TEXT, p_summary TEXT,
  p_severity TEXT DEFAULT 'ERROR', p_release_version TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NULL; END IF;

  UPDATE public.mobile_incidents
     SET occurrence_count = occurrence_count + 1,
         last_seen_at = now(),
         summary = LEFT(p_summary, 500),
         severity = p_severity
   WHERE component = p_component
     AND error_code = COALESCE(p_error_code, 'UNKNOWN')
     AND COALESCE(release_version, '-') = COALESCE(p_release_version, '-')
     AND status IN ('OPEN', 'INVESTIGATING')
   RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    INSERT INTO public.mobile_incidents (severity, component, error_code, summary, release_version, user_id, metadata)
    VALUES (p_severity, p_component, COALESCE(p_error_code, 'UNKNOWN'), LEFT(p_summary, 500), p_release_version, auth.uid(), p_metadata)
    RETURNING id INTO v_id;
  END IF;

  RETURN v_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.mobile_report_incident(TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.mobile_report_incident(TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) TO authenticated, service_role;

-- =====================================================================
-- GO-LIVE SNAPSHOT (echte Kennzahlen, nur Admin/Supervisor)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.mobile_golive_snapshot()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d TIMESTAMPTZ := date_trunc('day', now());
  res JSONB;
BEGIN
  IF NOT (public.has_role('Super Admin') OR public.has_role('Admin') OR public.is_mobile_supervisor()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT jsonb_build_object(
    'generated_at', now(),
    'today', jsonb_build_object(
      'inbound',  (SELECT count(*) FROM public.ac_messages WHERE created_at >= d AND direction = 'inbound'),
      'outbound', (SELECT count(*) FROM public.ac_messages WHERE created_at >= d AND direction = 'outbound'),
      'outbound_failed', (SELECT count(*) FROM public.ac_messages WHERE created_at >= d AND direction = 'outbound' AND COALESCE(delivery_status,'') IN ('failed','FAILED','error')),
      'tickets_created', (SELECT count(*) FROM public.tickets WHERE created_at >= d),
      'ai_requests', (SELECT count(*) FROM public.ai_classifications WHERE created_at >= d),
      'ai_failures', (SELECT count(*) FROM public.ai_classifications WHERE created_at >= d AND COALESCE(status,'') <> 'OK')
    ),
    'incidents', jsonb_build_object(
      'critical_open', (SELECT count(*) FROM public.mobile_incidents WHERE status IN ('OPEN','INVESTIGATING') AND severity = 'CRITICAL'),
      'open', (SELECT count(*) FROM public.mobile_incidents WHERE status IN ('OPEN','INVESTIGATING'))
    ),
    'devices', jsonb_build_object(
      'total', (SELECT count(*) FROM public.mobile_push_subscriptions WHERE revoked_at IS NULL),
      'push_active', (SELECT count(*) FROM public.mobile_push_subscriptions WHERE revoked_at IS NULL AND blocked_at IS NULL)
    ),
    'pilot', jsonb_build_object(
      'users', (SELECT count(DISTINCT u.user_id) FROM public.mobile_rollout_users u JOIN public.mobile_rollout_groups g ON g.id = u.group_id WHERE u.enabled AND g.is_active),
      'groups_active', (SELECT count(*) FROM public.mobile_rollout_groups WHERE is_active)
    ),
    'feedback_new', (SELECT count(*) FROM public.mobile_feedback WHERE status = 'NEW'),
    'duplicate_inbound', (
      SELECT COALESCE(sum(c - 1), 0) FROM (
        SELECT count(*) AS c FROM public.ac_messages
        WHERE created_at >= d AND direction = 'inbound' AND external_message_id IS NOT NULL
        GROUP BY external_message_id HAVING count(*) > 1
      ) x
    )
  ) INTO res;

  RETURN res;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.mobile_golive_snapshot() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.mobile_golive_snapshot() TO authenticated, service_role;

-- =====================================================================
-- PILOT-ÜBERSICHT
-- =====================================================================
CREATE OR REPLACE FUNCTION public.mobile_pilot_overview()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE res JSONB;
BEGIN
  IF NOT (public.has_role('Super Admin') OR public.has_role('Admin')) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT jsonb_build_object(
    'groups', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', g.id, 'name', g.name, 'description', g.description,
        'stage', g.stage, 'is_active', g.is_active,
        'members', (SELECT count(*) FROM public.mobile_rollout_users u WHERE u.group_id = g.id AND u.enabled)
      ) ORDER BY g.stage)
      FROM public.mobile_rollout_groups g), '[]'::jsonb),
    'members', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'user_id', u.user_id,
        'group', g.name,
        'enabled', u.enabled,
        'name', p.full_name,
        'email', p.email,
        'devices', (SELECT count(*) FROM public.mobile_push_subscriptions s WHERE s.user_id = u.user_id AND s.revoked_at IS NULL),
        'last_seen', (SELECT max(s.updated_at) FROM public.mobile_push_subscriptions s WHERE s.user_id = u.user_id)
      ) ORDER BY g.stage, p.full_name)
      FROM public.mobile_rollout_users u
      JOIN public.mobile_rollout_groups g ON g.id = u.group_id
      LEFT JOIN public.user_profiles p ON p.id = u.user_id), '[]'::jsonb)
  ) INTO res;

  RETURN res;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.mobile_pilot_overview() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.mobile_pilot_overview() TO authenticated, service_role;