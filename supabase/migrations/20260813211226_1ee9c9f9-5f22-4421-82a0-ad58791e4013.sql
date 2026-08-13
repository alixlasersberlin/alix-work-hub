
CREATE TABLE IF NOT EXISTS public.mobile_sync_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  enabled boolean NOT NULL DEFAULT false,
  scope text NOT NULL DEFAULT 'none',
  scope_value text,
  include_inactive boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.mobile_sync_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  device_name text NOT NULL DEFAULT 'iPhone',
  token_hash text NOT NULL,
  token_prefix text,
  status text NOT NULL DEFAULT 'active',
  last_sync_at timestamptz,
  last_ip text,
  user_agent text,
  contact_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_msd_user ON public.mobile_sync_devices(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_msd_token ON public.mobile_sync_devices(token_hash);

CREATE TABLE IF NOT EXISTS public.mobile_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  device_id uuid REFERENCES public.mobile_sync_devices(id) ON DELETE SET NULL,
  action text NOT NULL,
  status text NOT NULL DEFAULT 'ok',
  contact_count integer,
  message text,
  ip text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_msl_created ON public.mobile_sync_log(created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mobile_sync_settings TO authenticated;
GRANT ALL ON public.mobile_sync_settings TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mobile_sync_devices TO authenticated;
GRANT ALL ON public.mobile_sync_devices TO service_role;
GRANT SELECT ON public.mobile_sync_log TO authenticated;
GRANT ALL ON public.mobile_sync_log TO service_role;

ALTER TABLE public.mobile_sync_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobile_sync_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobile_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY mss_self_read ON public.mobile_sync_settings FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY mss_admin_write ON public.mobile_sync_settings FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY msd_self_read ON public.mobile_sync_devices FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY msd_self_write ON public.mobile_sync_devices FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

CREATE POLICY msl_read ON public.mobile_sync_log FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());
