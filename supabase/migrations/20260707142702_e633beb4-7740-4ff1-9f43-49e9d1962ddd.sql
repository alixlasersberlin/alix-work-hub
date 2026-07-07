
DROP POLICY IF EXISTS ccl_insert ON public.customer_communication_log;
CREATE POLICY ccl_insert ON public.customer_communication_log FOR INSERT TO authenticated
WITH CHECK (can_access_mail() AND (NOT has_role('Read Only'::text)) AND (NOT has_role('Read Only Audit'::text)));

DROP POLICY IF EXISTS mail_attachments_insert ON public.mail_attachments;
CREATE POLICY mail_attachments_insert ON public.mail_attachments FOR INSERT TO authenticated
WITH CHECK (can_access_mail() AND (NOT has_role('Read Only'::text)) AND (NOT has_role('Read Only Audit'::text)));

DROP POLICY IF EXISTS internal_msg_insert ON public.mail_internal_messages;
CREATE POLICY internal_msg_insert ON public.mail_internal_messages FOR INSERT TO authenticated
WITH CHECK ((sender_id = auth.uid()) AND can_access_mail() AND (NOT has_role('Read Only'::text)) AND (NOT has_role('Read Only Audit'::text)));

DROP POLICY IF EXISTS mail_messages_staff_insert ON public.mail_messages;
CREATE POLICY mail_messages_staff_insert ON public.mail_messages FOR INSERT TO authenticated
WITH CHECK (can_access_mail() AND (NOT has_role('Read Only'::text)) AND (NOT has_role('Read Only Audit'::text)));
