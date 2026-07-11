-- 1. mail_attachments UPDATE: add WITH CHECK
DROP POLICY IF EXISTS "mail_attachments_update" ON public.mail_attachments;
CREATE POLICY "mail_attachments_update" ON public.mail_attachments
  FOR UPDATE TO authenticated
  USING (public.can_access_mail())
  WITH CHECK (public.can_access_mail());

-- 2. esc_calendar_connections: own rows only (removes admin-wide token read)
DROP POLICY IF EXISTS "own connections" ON public.esc_calendar_connections;
CREATE POLICY "own connections" ON public.esc_calendar_connections
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 3. Remove anon full-row SELECT on esc_departments/esc_event_types.
--    Public booking flows fetch only whitelisted fields via SECURITY DEFINER RPCs.
DROP POLICY IF EXISTS "esc_dept_public_read_min" ON public.esc_departments;
DROP POLICY IF EXISTS "esc_evtype_public_read_min" ON public.esc_event_types;