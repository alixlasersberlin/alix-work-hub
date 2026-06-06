DROP POLICY IF EXISTS mail_notif_insert ON public.mail_notifications;
CREATE POLICY mail_notif_insert ON public.mail_notifications
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_admin());