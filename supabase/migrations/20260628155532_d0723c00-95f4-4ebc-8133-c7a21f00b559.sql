
DROP POLICY IF EXISTS as_rem_select ON public.as_reminders;
CREATE POLICY as_rem_select ON public.as_reminders FOR SELECT
USING (has_role('Super Admin'::text) OR has_role('Admin'::text) OR has_role('After Sales'::text) OR has_role('Vertrieb'::text) OR has_role('Marketing'::text) OR has_role('Service'::text) OR has_role('Order'::text) OR has_role('SACHBEARBEITUNG'::text));

DROP POLICY IF EXISTS as_tl_select ON public.as_timeline_events;
CREATE POLICY as_tl_select ON public.as_timeline_events FOR SELECT
USING (has_role('Super Admin'::text) OR has_role('Admin'::text) OR has_role('After Sales'::text) OR has_role('Vertrieb'::text) OR has_role('Marketing'::text) OR has_role('Service'::text) OR has_role('Serviceleitung'::text) OR has_role('Geschäftsführung'::text) OR has_role('Order'::text) OR has_role('SACHBEARBEITUNG'::text) OR has_role('Kundenservice'::text) OR has_role('Auftragsverwaltung'::text));

DROP POLICY IF EXISTS as_check_select ON public.as_checklist_items;
CREATE POLICY as_check_select ON public.as_checklist_items FOR SELECT
USING (has_role('Super Admin'::text) OR has_role('Admin'::text) OR has_role('After Sales'::text) OR has_role('Vertrieb'::text) OR has_role('Marketing'::text) OR has_role('Service'::text) OR has_role('Order'::text) OR has_role('SACHBEARBEITUNG'::text));
