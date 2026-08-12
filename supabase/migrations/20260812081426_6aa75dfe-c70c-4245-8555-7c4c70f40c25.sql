CREATE POLICY "esc_events_sa_admin_update" ON public.esc_events
FOR UPDATE TO authenticated
USING (has_role('Super Admin') OR has_role('Admin'))
WITH CHECK (has_role('Super Admin') OR has_role('Admin'));