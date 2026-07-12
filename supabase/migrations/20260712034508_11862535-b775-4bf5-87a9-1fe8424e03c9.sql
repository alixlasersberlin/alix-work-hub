-- 1) Tighten esc_signatures INSERT: require master-data management role
DROP POLICY IF EXISTS "esc_signatures op insert" ON public.esc_signatures;
CREATE POLICY "esc_signatures manage insert"
  ON public.esc_signatures
  FOR INSERT
  WITH CHECK (public.can_manage_esc_master());

-- 2) Block client-side inserts on mail_audit_logs (writes only via SECURITY DEFINER trigger)
DROP POLICY IF EXISTS "Only admins can insert mail audit logs" ON public.mail_audit_logs;
CREATE POLICY "mail_audit_logs_block_insert"
  ON public.mail_audit_logs
  FOR INSERT
  WITH CHECK (false);