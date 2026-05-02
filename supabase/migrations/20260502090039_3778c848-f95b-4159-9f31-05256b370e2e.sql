-- Fix privilege escalation: restrict self-update on user_profiles to safe columns only
DROP POLICY IF EXISTS "user can update own profile" ON public.user_profiles;

CREATE POLICY "user can update own profile"
ON public.user_profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND supplier_id IS NOT DISTINCT FROM (SELECT supplier_id FROM public.user_profiles WHERE id = auth.uid())
  AND account_status IS NOT DISTINCT FROM (SELECT account_status FROM public.user_profiles WHERE id = auth.uid())
  AND is_active IS NOT DISTINCT FROM (SELECT is_active FROM public.user_profiles WHERE id = auth.uid())
  AND invitation_status IS NOT DISTINCT FROM (SELECT invitation_status FROM public.user_profiles WHERE id = auth.uid())
  AND password_reset_required IS NOT DISTINCT FROM (SELECT password_reset_required FROM public.user_profiles WHERE id = auth.uid())
  AND department_id IS NOT DISTINCT FROM (SELECT department_id FROM public.user_profiles WHERE id = auth.uid())
);