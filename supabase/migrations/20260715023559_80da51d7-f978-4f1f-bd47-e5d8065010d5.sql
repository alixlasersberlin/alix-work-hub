
-- 1) ticket_departments: interne Nutzer für SELECT
DROP POLICY IF EXISTS "ticket_departments read authenticated" ON public.ticket_departments;
CREATE POLICY "ticket_departments read internal"
  ON public.ticket_departments FOR SELECT
  TO authenticated
  USING (public.is_internal_user());

-- 2) appointment_reminder_rules: interne Nutzer für SELECT
DROP POLICY IF EXISTS reminder_rules_read_all_authenticated ON public.appointment_reminder_rules;
CREATE POLICY reminder_rules_read_internal
  ON public.appointment_reminder_rules FOR SELECT
  TO authenticated
  USING (public.is_internal_user());

-- 3) ESC-Masterdaten-Policies: TO public -> TO authenticated
DROP POLICY IF EXISTS esc_dept_admin_insert ON public.esc_departments;
CREATE POLICY esc_dept_admin_insert ON public.esc_departments FOR INSERT TO authenticated WITH CHECK (esc_is_admin());
DROP POLICY IF EXISTS esc_dept_admin_update ON public.esc_departments;
CREATE POLICY esc_dept_admin_update ON public.esc_departments FOR UPDATE TO authenticated USING (esc_is_admin()) WITH CHECK (esc_is_admin());

DROP POLICY IF EXISTS esc_tpl_admin_insert ON public.esc_email_templates;
CREATE POLICY esc_tpl_admin_insert ON public.esc_email_templates FOR INSERT TO authenticated WITH CHECK (esc_is_admin());
DROP POLICY IF EXISTS esc_tpl_admin_update ON public.esc_email_templates;
CREATE POLICY esc_tpl_admin_update ON public.esc_email_templates FOR UPDATE TO authenticated USING (esc_is_admin()) WITH CHECK (esc_is_admin());

DROP POLICY IF EXISTS esc_empdept_admin_insert ON public.esc_employee_departments;
CREATE POLICY esc_empdept_admin_insert ON public.esc_employee_departments FOR INSERT TO authenticated WITH CHECK (esc_is_admin());
DROP POLICY IF EXISTS esc_empdept_admin_update ON public.esc_employee_departments;
CREATE POLICY esc_empdept_admin_update ON public.esc_employee_departments FOR UPDATE TO authenticated USING (esc_is_admin()) WITH CHECK (esc_is_admin());

DROP POLICY IF EXISTS esc_part_admin_insert ON public.esc_event_participants;
CREATE POLICY esc_part_admin_insert ON public.esc_event_participants FOR INSERT TO authenticated WITH CHECK (esc_is_admin());
DROP POLICY IF EXISTS esc_part_admin_update ON public.esc_event_participants;
CREATE POLICY esc_part_admin_update ON public.esc_event_participants FOR UPDATE TO authenticated USING (esc_is_admin()) WITH CHECK (esc_is_admin());

DROP POLICY IF EXISTS esc_evres_admin_insert ON public.esc_event_resources;
CREATE POLICY esc_evres_admin_insert ON public.esc_event_resources FOR INSERT TO authenticated WITH CHECK (esc_is_admin());
DROP POLICY IF EXISTS esc_evres_admin_update ON public.esc_event_resources;
CREATE POLICY esc_evres_admin_update ON public.esc_event_resources FOR UPDATE TO authenticated USING (esc_is_admin()) WITH CHECK (esc_is_admin());

DROP POLICY IF EXISTS esc_evtype_admin_insert ON public.esc_event_types;
CREATE POLICY esc_evtype_admin_insert ON public.esc_event_types FOR INSERT TO authenticated WITH CHECK (esc_is_admin());
DROP POLICY IF EXISTS esc_evtype_admin_update ON public.esc_event_types;
CREATE POLICY esc_evtype_admin_update ON public.esc_event_types FOR UPDATE TO authenticated USING (esc_is_admin()) WITH CHECK (esc_is_admin());

DROP POLICY IF EXISTS esc_events_admin_insert ON public.esc_events;
CREATE POLICY esc_events_admin_insert ON public.esc_events FOR INSERT TO authenticated WITH CHECK (esc_is_admin());
DROP POLICY IF EXISTS esc_events_admin_update ON public.esc_events;
CREATE POLICY esc_events_admin_update ON public.esc_events FOR UPDATE TO authenticated USING (esc_is_admin()) WITH CHECK (esc_is_admin());

DROP POLICY IF EXISTS esc_pub_admin_update ON public.esc_public_bookings;
CREATE POLICY esc_pub_admin_update ON public.esc_public_bookings FOR UPDATE TO authenticated USING (esc_is_admin()) WITH CHECK (esc_is_admin());

DROP POLICY IF EXISTS esc_res_admin_insert ON public.esc_resources;
CREATE POLICY esc_res_admin_insert ON public.esc_resources FOR INSERT TO authenticated WITH CHECK (esc_is_admin());
DROP POLICY IF EXISTS esc_res_admin_update ON public.esc_resources;
CREATE POLICY esc_res_admin_update ON public.esc_resources FOR UPDATE TO authenticated USING (esc_is_admin()) WITH CHECK (esc_is_admin());

DROP POLICY IF EXISTS "esc_signatures admin update" ON public.esc_signatures;
CREATE POLICY "esc_signatures admin update" ON public.esc_signatures FOR UPDATE TO authenticated
  USING (has_role('Super Admin'::text) OR has_role('Admin'::text))
  WITH CHECK (has_role('Super Admin'::text) OR has_role('Admin'::text));
DROP POLICY IF EXISTS "esc_signatures delete sa" ON public.esc_signatures;
CREATE POLICY "esc_signatures delete sa" ON public.esc_signatures FOR DELETE TO authenticated
  USING (has_role('Super Admin'::text));
