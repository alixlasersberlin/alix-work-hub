
DROP POLICY IF EXISTS "ech_msgs_read_auth" ON public.esc_ech_messages;
CREATE POLICY "ech_msgs_read_admin" ON public.esc_ech_messages
  FOR SELECT TO authenticated
  USING (has_role('Super Admin') OR has_role('Admin'));

DROP POLICY IF EXISTS "ech_tpl_read_auth" ON public.esc_ech_templates;
CREATE POLICY "ech_tpl_read_admin" ON public.esc_ech_templates
  FOR SELECT TO authenticated
  USING (has_role('Super Admin') OR has_role('Admin'));
