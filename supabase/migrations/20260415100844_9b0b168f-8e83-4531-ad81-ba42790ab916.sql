
-- Drop the overly permissive user update policy
DROP POLICY IF EXISTS "user can update own login sessions" ON public.login_sessions;

-- Only admins can update login sessions
CREATE POLICY "only admins can update login sessions"
ON public.login_sessions
FOR UPDATE
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());
