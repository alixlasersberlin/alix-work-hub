
-- Fix: Österreich role must not see non-AT customers/orders
DROP POLICY IF EXISTS "at role can read ch customers" ON public.customers;
DROP POLICY IF EXISTS "at role can read ch orders" ON public.orders;

-- Fix: Read Only / Read Only Audit roles must not write mail data
DROP POLICY IF EXISTS mail_attachments_insert ON public.mail_attachments;
CREATE POLICY mail_attachments_insert ON public.mail_attachments
  FOR INSERT WITH CHECK (
    can_access_mail()
    AND NOT has_role('Read Only')
    AND NOT has_role('Read Only Audit')
  );

DROP POLICY IF EXISTS mail_messages_staff_insert ON public.mail_messages;
CREATE POLICY mail_messages_staff_insert ON public.mail_messages
  FOR INSERT WITH CHECK (
    can_access_mail()
    AND NOT has_role('Read Only')
    AND NOT has_role('Read Only Audit')
  );

DROP POLICY IF EXISTS mail_messages_staff_update ON public.mail_messages;
CREATE POLICY mail_messages_staff_update ON public.mail_messages
  FOR UPDATE
  USING (
    can_access_mail()
    AND NOT has_role('Read Only')
    AND NOT has_role('Read Only Audit')
  )
  WITH CHECK (
    can_access_mail()
    AND NOT has_role('Read Only')
    AND NOT has_role('Read Only Audit')
  );

DROP POLICY IF EXISTS ccl_insert ON public.customer_communication_log;
CREATE POLICY ccl_insert ON public.customer_communication_log
  FOR INSERT WITH CHECK (
    can_access_mail()
    AND NOT has_role('Read Only')
    AND NOT has_role('Read Only Audit')
  );

DROP POLICY IF EXISTS internal_msg_insert ON public.mail_internal_messages;
CREATE POLICY internal_msg_insert ON public.mail_internal_messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid()
    AND can_access_mail()
    AND NOT has_role('Read Only')
    AND NOT has_role('Read Only Audit')
  );
