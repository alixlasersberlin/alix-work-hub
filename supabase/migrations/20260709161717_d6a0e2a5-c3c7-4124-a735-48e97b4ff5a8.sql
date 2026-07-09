
DROP POLICY IF EXISTS "admin can read all login sessions" ON public.login_sessions;
CREATE POLICY "super admin can read all login sessions"
  ON public.login_sessions FOR SELECT TO authenticated
  USING (has_role('Super Admin'::text));

DROP POLICY IF EXISTS "admin can read all otp challenges" ON public.otp_challenges;
CREATE POLICY "super admin can read all otp challenges"
  ON public.otp_challenges FOR SELECT TO authenticated
  USING (has_role('Super Admin'::text));
