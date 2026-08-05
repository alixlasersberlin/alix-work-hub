CREATE OR REPLACE FUNCTION public.cmr_can_write()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT has_role('Super Admin') OR has_role('Admin') OR has_role('Geschäftsführung') OR has_role('CMR');
$$;

REVOKE EXECUTE ON FUNCTION public.cmr_can_write() FROM anon;

DROP POLICY IF EXISTS cmr_docs_insert ON public.cmr_documents;
CREATE POLICY cmr_docs_insert ON public.cmr_documents FOR INSERT TO authenticated WITH CHECK (has_tenant_access(tenant_id) AND cmr_can_write());
DROP POLICY IF EXISTS cmr_docs_update ON public.cmr_documents;
CREATE POLICY cmr_docs_update ON public.cmr_documents FOR UPDATE TO authenticated USING (has_tenant_access(tenant_id) AND cmr_can_write()) WITH CHECK (has_tenant_access(tenant_id) AND cmr_can_write());

DROP POLICY IF EXISTS cmr_doc_items_all ON public.cmr_document_items;
CREATE POLICY cmr_doc_items_read ON public.cmr_document_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM cmr_documents d WHERE d.id = document_id AND has_tenant_access(d.tenant_id)));
CREATE POLICY cmr_doc_items_write ON public.cmr_document_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM cmr_documents d WHERE d.id = document_id AND has_tenant_access(d.tenant_id)) AND cmr_can_write())
  WITH CHECK (EXISTS (SELECT 1 FROM cmr_documents d WHERE d.id = document_id AND has_tenant_access(d.tenant_id)) AND cmr_can_write());

DROP POLICY IF EXISTS cmr_pay_insert ON public.cmr_payments;
CREATE POLICY cmr_pay_insert ON public.cmr_payments FOR INSERT TO authenticated WITH CHECK (has_tenant_access(tenant_id) AND cmr_can_write());
DROP POLICY IF EXISTS cmr_pay_update ON public.cmr_payments;
CREATE POLICY cmr_pay_update ON public.cmr_payments FOR UPDATE TO authenticated USING (has_tenant_access(tenant_id) AND cmr_can_write()) WITH CHECK (has_tenant_access(tenant_id) AND cmr_can_write());

DROP POLICY IF EXISTS cmr_items_insert ON public.cmr_items;
CREATE POLICY cmr_items_insert ON public.cmr_items FOR INSERT TO authenticated WITH CHECK (has_tenant_access(tenant_id) AND cmr_can_write());
DROP POLICY IF EXISTS cmr_items_update ON public.cmr_items;
CREATE POLICY cmr_items_update ON public.cmr_items FOR UPDATE TO authenticated USING (has_tenant_access(tenant_id) AND cmr_can_write()) WITH CHECK (has_tenant_access(tenant_id) AND cmr_can_write());

DROP POLICY IF EXISTS cmr_cat_insert ON public.cmr_item_categories;
CREATE POLICY cmr_cat_insert ON public.cmr_item_categories FOR INSERT TO authenticated WITH CHECK (has_tenant_access(tenant_id) AND cmr_can_write());
DROP POLICY IF EXISTS cmr_cat_update ON public.cmr_item_categories;
CREATE POLICY cmr_cat_update ON public.cmr_item_categories FOR UPDATE TO authenticated USING (has_tenant_access(tenant_id) AND cmr_can_write()) WITH CHECK (has_tenant_access(tenant_id) AND cmr_can_write());

DROP POLICY IF EXISTS cmr_projects_insert ON public.cmr_projects;
CREATE POLICY cmr_projects_insert ON public.cmr_projects FOR INSERT TO authenticated WITH CHECK (has_tenant_access(tenant_id) AND cmr_can_write());
DROP POLICY IF EXISTS cmr_projects_update ON public.cmr_projects;
CREATE POLICY cmr_projects_update ON public.cmr_projects FOR UPDATE TO authenticated USING (has_tenant_access(tenant_id) AND cmr_can_write()) WITH CHECK (has_tenant_access(tenant_id) AND cmr_can_write());

DROP POLICY IF EXISTS cmr_recplans_insert ON public.cmr_recurring_plans;
CREATE POLICY cmr_recplans_insert ON public.cmr_recurring_plans FOR INSERT TO authenticated WITH CHECK (has_tenant_access(tenant_id) AND cmr_can_write());
DROP POLICY IF EXISTS cmr_recplans_update ON public.cmr_recurring_plans;
CREATE POLICY cmr_recplans_update ON public.cmr_recurring_plans FOR UPDATE TO authenticated USING (has_tenant_access(tenant_id) AND cmr_can_write()) WITH CHECK (has_tenant_access(tenant_id) AND cmr_can_write());

DROP POLICY IF EXISTS cmr_nr_insert ON public.cmr_number_ranges;
CREATE POLICY cmr_nr_insert ON public.cmr_number_ranges FOR INSERT TO authenticated WITH CHECK (has_tenant_access(tenant_id) AND cmr_can_write());
DROP POLICY IF EXISTS cmr_nr_update ON public.cmr_number_ranges;
CREATE POLICY cmr_nr_update ON public.cmr_number_ranges FOR UPDATE TO authenticated USING (has_tenant_access(tenant_id) AND cmr_can_write()) WITH CHECK (has_tenant_access(tenant_id) AND cmr_can_write());

DROP POLICY IF EXISTS cmr_pdf_insert ON public.cmr_pdf_templates;
CREATE POLICY cmr_pdf_insert ON public.cmr_pdf_templates FOR INSERT TO authenticated WITH CHECK (has_tenant_access(tenant_id) AND cmr_can_write());
DROP POLICY IF EXISTS cmr_pdf_update ON public.cmr_pdf_templates;
CREATE POLICY cmr_pdf_update ON public.cmr_pdf_templates FOR UPDATE TO authenticated USING (has_tenant_access(tenant_id) AND cmr_can_write()) WITH CHECK (has_tenant_access(tenant_id) AND cmr_can_write());

DROP POLICY IF EXISTS cmr_mail_insert ON public.cmr_email_templates;
CREATE POLICY cmr_mail_insert ON public.cmr_email_templates FOR INSERT TO authenticated WITH CHECK (has_tenant_access(tenant_id) AND cmr_can_write());
DROP POLICY IF EXISTS cmr_mail_update ON public.cmr_email_templates;
CREATE POLICY cmr_mail_update ON public.cmr_email_templates FOR UPDATE TO authenticated USING (has_tenant_access(tenant_id) AND cmr_can_write()) WITH CHECK (has_tenant_access(tenant_id) AND cmr_can_write());

DROP POLICY IF EXISTS cmr_settings_write ON public.cmr_settings;
CREATE POLICY cmr_settings_write ON public.cmr_settings FOR INSERT TO authenticated WITH CHECK (has_tenant_access(tenant_id) AND cmr_can_write());
DROP POLICY IF EXISTS cmr_settings_update ON public.cmr_settings;
CREATE POLICY cmr_settings_update ON public.cmr_settings FOR UPDATE TO authenticated USING (has_tenant_access(tenant_id) AND cmr_can_write()) WITH CHECK (has_tenant_access(tenant_id) AND cmr_can_write());