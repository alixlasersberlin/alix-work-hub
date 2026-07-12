-- Remove Admin-role UPDATE bypass on otp_challenges. Only service_role should update these (edge function context).
DROP POLICY IF EXISTS "admins can update otp challenges" ON public.otp_challenges;

-- Remove Admin-role INSERT forgery on login_sessions. Only service_role or the owner can create.
DROP POLICY IF EXISTS "admins can insert login sessions" ON public.login_sessions;
CREATE POLICY "users can insert own login sessions"
  ON public.login_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Tighten UPDATE on login_sessions to Super Admin (or service_role bypass).
DROP POLICY IF EXISTS "only admins can update login sessions" ON public.login_sessions;
CREATE POLICY "only super admin can update login sessions"
  ON public.login_sessions
  FOR UPDATE
  TO authenticated
  USING (has_role('Super Admin'::text))
  WITH CHECK (has_role('Super Admin'::text));