
ALTER TABLE public.user_mfa_secrets
  ADD COLUMN IF NOT EXISTS totp_secret_encrypted text,
  ADD COLUMN IF NOT EXISTS totp_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS enrolled_at timestamptz,
  ADD COLUMN IF NOT EXISTS disabled_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_used_at timestamptz;

CREATE TABLE IF NOT EXISTS public.mfa_recovery_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  code_hash text NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mfa_recovery_codes_user ON public.mfa_recovery_codes(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mfa_recovery_codes TO authenticated;
GRANT ALL ON public.mfa_recovery_codes TO service_role;
ALTER TABLE public.mfa_recovery_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own recovery codes read" ON public.mfa_recovery_codes
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "service role manages recovery codes" ON public.mfa_recovery_codes
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.mfa_webauthn_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  credential_id text NOT NULL UNIQUE,
  public_key text NOT NULL,
  counter bigint NOT NULL DEFAULT 0,
  transports text[],
  device_label text,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mfa_webauthn_user ON public.mfa_webauthn_credentials(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mfa_webauthn_credentials TO authenticated;
GRANT ALL ON public.mfa_webauthn_credentials TO service_role;
ALTER TABLE public.mfa_webauthn_credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own webauthn creds read" ON public.mfa_webauthn_credentials
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own webauthn creds delete" ON public.mfa_webauthn_credentials
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "service role manages webauthn creds" ON public.mfa_webauthn_credentials
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.mfa_reauth_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  method text NOT NULL CHECK (method IN ('totp','webauthn','password','recovery')),
  purpose text NOT NULL,
  verified_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  ip_hint text,
  user_agent text
);
CREATE INDEX IF NOT EXISTS idx_mfa_reauth_user_purpose ON public.mfa_reauth_events(user_id, purpose, expires_at DESC);
GRANT SELECT ON public.mfa_reauth_events TO authenticated;
GRANT ALL ON public.mfa_reauth_events TO service_role;
ALTER TABLE public.mfa_reauth_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own reauth read" ON public.mfa_reauth_events
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "service role manages reauth" ON public.mfa_reauth_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS mfa_grace_until timestamptz,
  ADD COLUMN IF NOT EXISTS mfa_exempt boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS mfa_exempt_reason text,
  ADD COLUMN IF NOT EXISTS mfa_exempt_by uuid;

-- 7-Tage-Grace für bestehende Admin-Rollen
UPDATE public.user_profiles
   SET mfa_grace_until = now() + interval '7 days'
 WHERE mfa_grace_until IS NULL
   AND id IN (
     SELECT ur.user_id FROM public.user_roles ur
     JOIN public.roles r ON r.id = ur.role_id
     WHERE r.name IN ('Super Admin','Admin','Geschäftsführung')
   );

CREATE OR REPLACE FUNCTION public.mfa_required_for_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
     WHERE ur.user_id = _user_id
       AND r.name IN ('Super Admin','Admin','Geschäftsführung')
  ) AND NOT COALESCE((SELECT mfa_exempt FROM public.user_profiles WHERE id = _user_id), false);
$$;

CREATE OR REPLACE FUNCTION public.mfa_status_for_user(_user_id uuid)
RETURNS TABLE (
  required boolean,
  enrolled boolean,
  in_grace boolean,
  grace_until timestamptz,
  has_totp boolean,
  webauthn_count integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.mfa_required_for_user(_user_id) AS required,
    EXISTS (SELECT 1 FROM public.user_mfa_secrets WHERE user_id = _user_id AND totp_confirmed_at IS NOT NULL AND disabled_at IS NULL) AS enrolled,
    COALESCE((SELECT mfa_grace_until FROM public.user_profiles WHERE id = _user_id), now()) > now() AS in_grace,
    (SELECT mfa_grace_until FROM public.user_profiles WHERE id = _user_id) AS grace_until,
    EXISTS (SELECT 1 FROM public.user_mfa_secrets WHERE user_id = _user_id AND totp_confirmed_at IS NOT NULL AND disabled_at IS NULL) AS has_totp,
    (SELECT COUNT(*)::int FROM public.mfa_webauthn_credentials WHERE user_id = _user_id) AS webauthn_count;
$$;

CREATE OR REPLACE FUNCTION public.has_valid_reauth(_user_id uuid, _purpose text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.mfa_reauth_events
     WHERE user_id = _user_id
       AND purpose = _purpose
       AND expires_at > now()
  );
$$;

GRANT EXECUTE ON FUNCTION public.mfa_required_for_user(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mfa_status_for_user(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_valid_reauth(uuid, text) TO authenticated, service_role;
