
DROP POLICY IF EXISTS "users can insert own login sessions" ON public.login_sessions;
CREATE POLICY "users can insert own login sessions"
ON public.login_sessions
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND otp_verified_at IS NULL
  AND reauth_required = true
);

DROP POLICY IF EXISTS "mps self" ON public.mobile_push_subscriptions;

CREATE POLICY "mps self select"
ON public.mobile_push_subscriptions
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "mps self insert"
ON public.mobile_push_subscriptions
FOR INSERT TO authenticated
WITH CHECK (
  is_admin()
  OR (
    user_id = auth.uid()
    AND approval_status IS NOT DISTINCT FROM 'pending'
    AND approved_by IS NULL
    AND approved_at IS NULL
    AND blocked_at IS NULL
    AND blocked_by IS NULL
  )
);

CREATE POLICY "mps self update"
ON public.mobile_push_subscriptions
FOR UPDATE TO authenticated
USING (user_id = auth.uid() OR is_admin())
WITH CHECK (
  is_admin()
  OR (
    user_id = auth.uid()
    AND approval_status IS NOT DISTINCT FROM (SELECT m.approval_status FROM public.mobile_push_subscriptions m WHERE m.id = mobile_push_subscriptions.id)
    AND approved_by IS NOT DISTINCT FROM (SELECT m.approved_by FROM public.mobile_push_subscriptions m WHERE m.id = mobile_push_subscriptions.id)
    AND approved_at IS NOT DISTINCT FROM (SELECT m.approved_at FROM public.mobile_push_subscriptions m WHERE m.id = mobile_push_subscriptions.id)
    AND blocked_at IS NOT DISTINCT FROM (SELECT m.blocked_at FROM public.mobile_push_subscriptions m WHERE m.id = mobile_push_subscriptions.id)
    AND blocked_by IS NOT DISTINCT FROM (SELECT m.blocked_by FROM public.mobile_push_subscriptions m WHERE m.id = mobile_push_subscriptions.id)
  )
);

CREATE POLICY "mps self delete"
ON public.mobile_push_subscriptions
FOR DELETE TO authenticated
USING (user_id = auth.uid() OR is_admin());
