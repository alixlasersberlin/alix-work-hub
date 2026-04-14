-- INSERT: only admins (service role handles system inserts)
CREATE POLICY "admins can insert login sessions"
ON public.login_sessions
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

-- UPDATE: user can update own, admin can update all
CREATE POLICY "user can update own login sessions"
ON public.login_sessions
FOR UPDATE
TO authenticated
USING (user_id = auth.uid() OR public.is_admin())
WITH CHECK (user_id = auth.uid() OR public.is_admin());

-- DELETE: user can delete own, admin can delete all
CREATE POLICY "user can delete own login sessions"
ON public.login_sessions
FOR DELETE
TO authenticated
USING (user_id = auth.uid() OR public.is_admin());