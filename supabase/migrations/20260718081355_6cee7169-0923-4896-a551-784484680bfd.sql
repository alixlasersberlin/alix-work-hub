
DROP POLICY IF EXISTS "Authenticated read analyses" ON public.sig_ai_analyses;
CREATE POLICY "Staff read analyses" ON public.sig_ai_analyses FOR SELECT USING (has_role('Super Admin') OR has_role('Admin'));

DROP POLICY IF EXISTS "Authenticated read chains" ON public.sig_approval_chains;
CREATE POLICY "Staff read chains" ON public.sig_approval_chains FOR SELECT USING (has_role('Super Admin') OR has_role('Admin'));

DROP POLICY IF EXISTS "Authenticated read approval states" ON public.sig_approval_states;
CREATE POLICY "Staff read approval states" ON public.sig_approval_states FOR SELECT USING (has_role('Super Admin') OR has_role('Admin') OR current_approver = auth.uid());

DROP POLICY IF EXISTS "facsimile_settings_read_auth" ON public.sig_facsimile_settings;
CREATE POLICY "facsimile_settings_read_staff" ON public.sig_facsimile_settings FOR SELECT USING (has_role('Super Admin') OR has_role('Admin'));

DROP POLICY IF EXISTS "sig_templates_read" ON public.sig_templates;
CREATE POLICY "sig_templates_read_staff" ON public.sig_templates FOR SELECT USING (has_role('Super Admin') OR has_role('Admin'));

DROP POLICY IF EXISTS "tpl_fields_read" ON public.sig_template_fields;
CREATE POLICY "tpl_fields_read_staff" ON public.sig_template_fields FOR SELECT USING (has_role('Super Admin') OR has_role('Admin'));

DROP POLICY IF EXISTS "sig_reminder_rules_read" ON public.sig_reminder_rules;
CREATE POLICY "sig_reminder_rules_read_staff" ON public.sig_reminder_rules FOR SELECT USING (has_role('Super Admin') OR has_role('Admin'));
