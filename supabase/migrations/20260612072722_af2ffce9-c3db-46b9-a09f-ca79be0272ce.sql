DROP POLICY IF EXISTS "wasc_tpl_read" ON public.whatsapp_sc_templates;
CREATE POLICY "wasc_tpl_read_staff" ON public.whatsapp_sc_templates
  FOR SELECT TO authenticated
  USING (public.is_admin() OR public.has_role('Kundenservice') OR public.can_access_mail());