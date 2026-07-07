
DROP POLICY IF EXISTS as_check_select ON public.as_checklist_items;
CREATE POLICY as_check_select ON public.as_checklist_items FOR SELECT TO authenticated
USING (has_role('Super Admin') OR has_role('Admin') OR has_role('After Sales') OR has_role('Vertrieb') OR has_role('Marketing') OR has_role('Service') OR has_role('Order') OR has_role('SACHBEARBEITUNG'));

DROP POLICY IF EXISTS as_rem_select ON public.as_reminders;
CREATE POLICY as_rem_select ON public.as_reminders FOR SELECT TO authenticated
USING (has_role('Super Admin') OR has_role('Admin') OR has_role('After Sales') OR has_role('Vertrieb') OR has_role('Marketing') OR has_role('Service') OR has_role('Order') OR has_role('SACHBEARBEITUNG'));

DROP POLICY IF EXISTS as_tl_select ON public.as_timeline_events;
CREATE POLICY as_tl_select ON public.as_timeline_events FOR SELECT TO authenticated
USING (has_role('Super Admin') OR has_role('Admin') OR has_role('After Sales') OR has_role('Vertrieb') OR has_role('Marketing') OR has_role('Service') OR has_role('Serviceleitung') OR has_role('Geschäftsführung') OR has_role('Order') OR has_role('SACHBEARBEITUNG') OR has_role('Kundenservice') OR has_role('Auftragsverwaltung'));

DROP POLICY IF EXISTS mail_messages_staff_update ON public.mail_messages;
CREATE POLICY mail_messages_staff_update ON public.mail_messages FOR UPDATE TO authenticated
USING (can_access_mail() AND NOT has_role('Read Only') AND NOT has_role('Read Only Audit'))
WITH CHECK (can_access_mail() AND NOT has_role('Read Only') AND NOT has_role('Read Only Audit'));

DROP POLICY IF EXISTS "admins and order can insert zoho items" ON public.zoho_items;
CREATE POLICY "admins and order can insert zoho items" ON public.zoho_items FOR INSERT TO authenticated
WITH CHECK (is_admin() OR has_role('Order'));

DROP POLICY IF EXISTS "admins and order can update zoho items" ON public.zoho_items;
CREATE POLICY "admins and order can update zoho items" ON public.zoho_items FOR UPDATE TO authenticated
USING (is_admin() OR has_role('Order'))
WITH CHECK (is_admin() OR has_role('Order'));
