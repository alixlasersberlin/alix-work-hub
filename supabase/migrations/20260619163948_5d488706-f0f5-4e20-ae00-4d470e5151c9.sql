
-- Fix offers INSERT: restrict to roles that legitimately create offers
DROP POLICY IF EXISTS offers_insert_authenticated ON public.offers;
CREATE POLICY offers_insert_authenticated ON public.offers
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR public.can_manage_orders()
    OR public.has_role('Vertrieb')
    OR public.has_role('Vertriebsleitung')
    OR public.has_role('Finance')
  );

-- Fix integration_logs INSERT: restrict to admin (edge functions use service_role and bypass RLS)
DROP POLICY IF EXISTS integration_logs_insert ON public.integration_logs;
CREATE POLICY integration_logs_insert ON public.integration_logs
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

-- Retarget DELETE policies from public -> authenticated (intent matches has_role check)
DROP POLICY IF EXISTS "da del" ON public.dispatch_attachments;
CREATE POLICY "da del" ON public.dispatch_attachments
  FOR DELETE TO authenticated
  USING (public.has_role('Super Admin'));

DROP POLICY IF EXISTS "dup del" ON public.dispatch_used_parts;
CREATE POLICY "dup del" ON public.dispatch_used_parts
  FOR DELETE TO authenticated
  USING (public.has_role('Super Admin'));

DROP POLICY IF EXISTS mail_notes_delete ON public.mail_notes;
CREATE POLICY mail_notes_delete ON public.mail_notes
  FOR DELETE TO authenticated
  USING (public.has_role('Super Admin'));

DROP POLICY IF EXISTS mail_notif_delete ON public.mail_notifications;
CREATE POLICY mail_notif_delete ON public.mail_notifications
  FOR DELETE TO authenticated
  USING (public.has_role('Super Admin'));
