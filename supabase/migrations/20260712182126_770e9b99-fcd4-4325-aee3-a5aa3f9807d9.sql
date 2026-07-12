
DROP POLICY IF EXISTS "User can read own requests" ON public.role_change_requests;
CREATE POLICY "User can read own requests" ON public.role_change_requests
  FOR SELECT USING (requested_by = auth.uid() OR target_user_id = auth.uid());
