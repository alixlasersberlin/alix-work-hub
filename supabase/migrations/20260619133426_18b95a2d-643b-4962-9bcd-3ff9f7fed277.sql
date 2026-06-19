
DROP POLICY IF EXISTS "da del" ON public.dispatch_attachments;
CREATE POLICY "da del" ON public.dispatch_attachments FOR DELETE USING (has_role('Super Admin'));

DROP POLICY IF EXISTS "dup del" ON public.dispatch_used_parts;
CREATE POLICY "dup del" ON public.dispatch_used_parts FOR DELETE USING (has_role('Super Admin'));

DROP POLICY IF EXISTS "mail_notes_delete" ON public.mail_notes;
CREATE POLICY "mail_notes_delete" ON public.mail_notes FOR DELETE USING (has_role('Super Admin'));

DROP POLICY IF EXISTS "mail_notif_delete" ON public.mail_notifications;
CREATE POLICY "mail_notif_delete" ON public.mail_notifications FOR DELETE USING (has_role('Super Admin'));
