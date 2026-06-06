DROP POLICY IF EXISTS device_health_read_authenticated ON public.device_health_scores;
CREATE POLICY device_health_read_scoped ON public.device_health_scores
  FOR SELECT TO authenticated
  USING (public.can_access_maintenance());