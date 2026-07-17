
-- Restrict policies to authenticated role for defense-in-depth
DROP POLICY IF EXISTS pdfoi_insert ON public.pdf_order_imports;
CREATE POLICY pdfoi_insert ON public.pdf_order_imports FOR INSERT TO authenticated WITH CHECK (uploaded_by = auth.uid());

DROP POLICY IF EXISTS pdfoi_delete ON public.pdf_order_imports;
CREATE POLICY pdfoi_delete ON public.pdf_order_imports FOR DELETE TO authenticated USING (has_role('Super Admin'::text));

DROP POLICY IF EXISTS sales_followups_update ON public.sales_followups;
CREATE POLICY sales_followups_update ON public.sales_followups FOR UPDATE TO authenticated
  USING (is_admin() OR has_role('Vertrieb'::text) OR has_role('Vertriebsleitung'::text) OR has_role('Order'::text) OR has_role('SACHBEARBEITUNG'::text))
  WITH CHECK (is_admin() OR has_role('Vertrieb'::text) OR has_role('Vertriebsleitung'::text) OR has_role('Order'::text) OR has_role('SACHBEARBEITUNG'::text));

DROP POLICY IF EXISTS sales_leads_update ON public.sales_leads;
CREATE POLICY sales_leads_update ON public.sales_leads FOR UPDATE TO authenticated
  USING (is_admin() OR has_role('Vertrieb'::text) OR has_role('Vertriebsleitung'::text) OR has_role('Order'::text) OR has_role('SACHBEARBEITUNG'::text))
  WITH CHECK (is_admin() OR has_role('Vertrieb'::text) OR has_role('Vertriebsleitung'::text) OR has_role('Order'::text) OR has_role('SACHBEARBEITUNG'::text));

DROP POLICY IF EXISTS "Anyone can read maintenance status" ON public.system_maintenance;
CREATE POLICY "Authenticated can read maintenance status" ON public.system_maintenance FOR SELECT TO authenticated USING (true);
