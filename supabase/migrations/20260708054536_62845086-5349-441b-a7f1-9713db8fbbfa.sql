
-- Fix esc_audit_log: restrict INSERT to entries owned by the current user
DROP POLICY IF EXISTS esc_audit_insert_auth ON public.esc_audit_log;
CREATE POLICY esc_audit_insert_auth ON public.esc_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (changed_by = auth.uid());

-- Fix mail_internal_messages update policy: add matching WITH CHECK to prevent scope expansion
DROP POLICY IF EXISTS internal_msg_update ON public.mail_internal_messages;
CREATE POLICY internal_msg_update ON public.mail_internal_messages
  FOR UPDATE
  USING (is_admin() OR (recipient_user_id = auth.uid()) OR (sender_id = auth.uid()))
  WITH CHECK (is_admin() OR (recipient_user_id = auth.uid()) OR (sender_id = auth.uid()));
