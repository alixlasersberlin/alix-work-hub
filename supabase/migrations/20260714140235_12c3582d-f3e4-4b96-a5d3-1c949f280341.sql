DROP POLICY IF EXISTS esc_events_auth_insert ON public.esc_events;

CREATE POLICY esc_events_auth_insert ON public.esc_events
FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid());

-- Update-Policy erweitern, damit Mitarbeiter Termine ihrer Abteilungen mitpflegen können
DROP POLICY IF EXISTS esc_events_assigned_update ON public.esc_events;
CREATE POLICY esc_events_assigned_update ON public.esc_events
FOR UPDATE TO authenticated
USING (
  assigned_user_id = auth.uid()
  OR created_by = auth.uid()
  OR department_id IN (SELECT public.esc_user_department_ids(auth.uid()))
)
WITH CHECK (
  assigned_user_id = auth.uid()
  OR created_by = auth.uid()
  OR department_id IN (SELECT public.esc_user_department_ids(auth.uid()))
);