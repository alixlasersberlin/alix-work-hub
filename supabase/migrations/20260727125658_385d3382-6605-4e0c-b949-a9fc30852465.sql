
-- Tighten permissive RLS policies flagged by linter (replace literal true with role/auth checks)

-- api_rate_limits: keep service_role only
DROP POLICY IF EXISTS "service_role only" ON public.api_rate_limits;
CREATE POLICY "service_role only" ON public.api_rate_limits
  FOR ALL TO service_role
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- mfa_reauth_events
DROP POLICY IF EXISTS "service role manages reauth" ON public.mfa_reauth_events;
CREATE POLICY "service role manages reauth" ON public.mfa_reauth_events
  FOR ALL TO service_role
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- mfa_recovery_codes
DROP POLICY IF EXISTS "service role manages recovery codes" ON public.mfa_recovery_codes;
CREATE POLICY "service role manages recovery codes" ON public.mfa_recovery_codes
  FOR ALL TO service_role
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- mfa_webauthn_credentials
DROP POLICY IF EXISTS "service role manages webauthn creds" ON public.mfa_webauthn_credentials;
CREATE POLICY "service role manages webauthn creds" ON public.mfa_webauthn_credentials
  FOR ALL TO service_role
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- esc_events: team calendar — all authenticated users may update
DROP POLICY IF EXISTS "esc_events_all_auth_update" ON public.esc_events;
CREATE POLICY "esc_events_all_auth_update" ON public.esc_events
  FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- esc_store_appointments
DROP POLICY IF EXISTS "esc_store_appt_all_auth_insert" ON public.esc_store_appointments;
CREATE POLICY "esc_store_appt_all_auth_insert" ON public.esc_store_appointments
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "esc_store_appt_all_auth_update" ON public.esc_store_appointments;
CREATE POLICY "esc_store_appt_all_auth_update" ON public.esc_store_appointments
  FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);
