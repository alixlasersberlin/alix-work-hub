DROP POLICY IF EXISTS mail_audit_logs_insert ON public.mail_audit_logs;
CREATE POLICY mail_audit_logs_insert ON public.mail_audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.can_access_mail());

CREATE POLICY capas_update_qm ON public.capas
  FOR UPDATE TO authenticated
  USING (public.can_access_qm())
  WITH CHECK (public.can_access_qm());