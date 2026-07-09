
DROP POLICY IF EXISTS internal_msg_insert ON public.mail_internal_messages;
CREATE POLICY internal_msg_insert ON public.mail_internal_messages
  FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid());

DROP POLICY IF EXISTS internal_msg_select ON public.mail_internal_messages;
CREATE POLICY internal_msg_select ON public.mail_internal_messages
  FOR SELECT TO authenticated
  USING (
    is_admin()
    OR has_role('Geschäftsführung')
    OR sender_id = auth.uid()
    OR recipient_user_id = auth.uid()
    OR (recipient_department IS NOT NULL AND recipient_department = ANY (user_mailboxes()))
  );
