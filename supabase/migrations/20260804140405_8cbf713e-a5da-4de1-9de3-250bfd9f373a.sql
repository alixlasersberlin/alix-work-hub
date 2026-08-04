CREATE OR REPLACE FUNCTION public.esc_is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = auth.uid())
     AND EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid());
$$;

REVOKE EXECUTE ON FUNCTION public.esc_is_staff() FROM anon;

DROP POLICY IF EXISTS "esc_events_all_auth_read" ON public.esc_events;
DROP POLICY IF EXISTS "esc_events_all_auth_update" ON public.esc_events;

CREATE POLICY "esc_events_staff_read"
ON public.esc_events FOR SELECT
TO authenticated
USING (deleted_at IS NULL AND public.esc_is_staff());

CREATE POLICY "esc_events_staff_update"
ON public.esc_events FOR UPDATE
TO authenticated
USING (public.esc_is_staff())
WITH CHECK (public.esc_is_staff());