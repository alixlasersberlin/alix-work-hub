
DROP POLICY IF EXISTS "as_cases_update" ON public.as_cases;
CREATE POLICY "as_cases_update" ON public.as_cases FOR UPDATE
USING (has_role('Super Admin'::text) OR has_role('Admin'::text) OR has_role('After Sales'::text) OR has_role('Vertrieb'::text) OR has_role('Marketing'::text) OR has_role('Service'::text) OR has_role('Order'::text) OR has_role('SACHBEARBEITUNG'::text))
WITH CHECK (has_role('Super Admin'::text) OR has_role('Admin'::text) OR has_role('After Sales'::text) OR has_role('Vertrieb'::text) OR has_role('Marketing'::text) OR has_role('Service'::text) OR has_role('Order'::text) OR has_role('SACHBEARBEITUNG'::text));

DROP POLICY IF EXISTS "sales_followups_update" ON public.sales_followups;
CREATE POLICY "sales_followups_update" ON public.sales_followups FOR UPDATE
USING (is_admin() OR has_role('Vertrieb'::text) OR has_role('Vertriebsleitung'::text) OR has_role('Order'::text) OR has_role('SACHBEARBEITUNG'::text))
WITH CHECK (is_admin() OR has_role('Vertrieb'::text) OR has_role('Vertriebsleitung'::text) OR has_role('Order'::text) OR has_role('SACHBEARBEITUNG'::text));

DROP POLICY IF EXISTS "sales_leads_update" ON public.sales_leads;
CREATE POLICY "sales_leads_update" ON public.sales_leads FOR UPDATE
USING (is_admin() OR has_role('Vertrieb'::text) OR has_role('Vertriebsleitung'::text) OR has_role('Order'::text) OR has_role('SACHBEARBEITUNG'::text))
WITH CHECK (is_admin() OR has_role('Vertrieb'::text) OR has_role('Vertriebsleitung'::text) OR has_role('Order'::text) OR has_role('SACHBEARBEITUNG'::text));
