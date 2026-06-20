-- Audit-Log-Verschärfung: Updates und Deletes durch Clients explizit verbieten.
-- Damit kann auch ein kompromittiertes JWT keine bestehenden Audit-Einträge
-- modifizieren oder löschen. Service-Role (Edge Functions) bleibt zuständig
-- für eventuelle Wartungsaufgaben und umgeht RLS.

DROP POLICY IF EXISTS "audit_logs_block_update" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_block_delete" ON public.audit_logs;

CREATE POLICY "audit_logs_block_update"
  ON public.audit_logs
  FOR UPDATE
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);

CREATE POLICY "audit_logs_block_delete"
  ON public.audit_logs
  FOR DELETE
  TO authenticated, anon
  USING (false);

-- Gleiche Härtung für Mail-Audit-Logs
DROP POLICY IF EXISTS "mail_audit_logs_block_update" ON public.mail_audit_logs;
DROP POLICY IF EXISTS "mail_audit_logs_block_delete" ON public.mail_audit_logs;

CREATE POLICY "mail_audit_logs_block_update"
  ON public.mail_audit_logs
  FOR UPDATE
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);

CREATE POLICY "mail_audit_logs_block_delete"
  ON public.mail_audit_logs
  FOR DELETE
  TO authenticated, anon
  USING (false);