CREATE TABLE IF NOT EXISTS public.trusted_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  device_id text NOT NULL,
  device_name text,
  platform text,
  app_version text,
  trusted boolean NOT NULL DEFAULT false,
  biometric_enabled boolean NOT NULL DEFAULT false,
  pin_enabled boolean NOT NULL DEFAULT false,
  auto_lock_minutes integer NOT NULL DEFAULT 5,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  revoked_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trusted_devices_user_device_uniq UNIQUE (user_id, device_id)
);

GRANT SELECT, INSERT, UPDATE ON public.trusted_devices TO authenticated;
GRANT ALL ON public.trusted_devices TO service_role;

ALTER TABLE public.trusted_devices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "td_select_own_or_admin" ON public.trusted_devices;
CREATE POLICY "td_select_own_or_admin" ON public.trusted_devices
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role('Super Admin') OR public.has_role('Admin'));

DROP POLICY IF EXISTS "td_insert_own" ON public.trusted_devices;
CREATE POLICY "td_insert_own" ON public.trusted_devices
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "td_update_own_or_admin" ON public.trusted_devices;
CREATE POLICY "td_update_own_or_admin" ON public.trusted_devices
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role('Super Admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role('Super Admin'));

CREATE INDEX IF NOT EXISTS idx_trusted_devices_user ON public.trusted_devices (user_id, revoked_at);

CREATE OR REPLACE FUNCTION public.trusted_devices_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_trusted_devices_touch ON public.trusted_devices;
CREATE TRIGGER trg_trusted_devices_touch BEFORE UPDATE ON public.trusted_devices
FOR EACH ROW EXECUTE FUNCTION public.trusted_devices_touch();

-- Geräte/Sitzungen des angemeldeten Benutzers (Push-Geräte + vertraute Geräte zusammengeführt)
CREATE OR REPLACE FUNCTION public.mobile_my_devices()
RETURNS TABLE (
  device_id text,
  device_name text,
  platform text,
  last_seen_at timestamptz,
  created_at timestamptz,
  biometric_enabled boolean,
  pin_enabled boolean,
  push_registered boolean,
  revoked_at timestamptz,
  is_current boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    COALESCE(td.device_id, mps.device_id, mps.id::text) AS device_id,
    COALESCE(td.device_name, mps.device_name, mps.browser) AS device_name,
    COALESCE(td.platform, mps.platform, mps.os) AS platform,
    GREATEST(COALESCE(td.last_seen_at, to_timestamp(0)), COALESCE(mps.last_seen_at, to_timestamp(0))) AS last_seen_at,
    LEAST(COALESCE(td.created_at, now()), COALESCE(mps.created_at, now())) AS created_at,
    COALESCE(td.biometric_enabled, false) AS biometric_enabled,
    COALESCE(td.pin_enabled, false) AS pin_enabled,
    (mps.id IS NOT NULL) AS push_registered,
    COALESCE(td.revoked_at, mps.revoked_at) AS revoked_at,
    false AS is_current
  FROM public.trusted_devices td
  FULL OUTER JOIN public.mobile_push_subscriptions mps
    ON mps.user_id = td.user_id AND mps.device_id = td.device_id
  WHERE COALESCE(td.user_id, mps.user_id) = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.mobile_my_devices() TO authenticated;

-- Widerruf: eigenes Gerät oder alle anderen Geräte des Benutzers
CREATE OR REPLACE FUNCTION public.mobile_revoke_devices(_device_id text DEFAULT NULL, _all_others boolean DEFAULT false, _current_device_id text DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _n integer := 0;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  IF _all_others THEN
    UPDATE public.trusted_devices SET revoked_at = now(), trusted = false, revoked_by = _uid
      WHERE user_id = _uid AND revoked_at IS NULL AND device_id IS DISTINCT FROM _current_device_id;
    GET DIAGNOSTICS _n = ROW_COUNT;
    UPDATE public.mobile_push_subscriptions SET revoked_at = now()
      WHERE user_id = _uid AND revoked_at IS NULL AND COALESCE(device_id,'') IS DISTINCT FROM COALESCE(_current_device_id,'');
  ELSE
    IF _device_id IS NULL THEN RAISE EXCEPTION 'device_id required'; END IF;
    UPDATE public.trusted_devices SET revoked_at = now(), trusted = false, revoked_by = _uid
      WHERE user_id = _uid AND device_id = _device_id AND revoked_at IS NULL;
    GET DIAGNOSTICS _n = ROW_COUNT;
    UPDATE public.mobile_push_subscriptions SET revoked_at = now()
      WHERE user_id = _uid AND device_id = _device_id AND revoked_at IS NULL;
  END IF;

  RETURN _n;
END; $$;

GRANT EXECUTE ON FUNCTION public.mobile_revoke_devices(text, boolean, text) TO authenticated;