DO $$
DECLARE t text;
DECLARE id_tables text[] := ARRAY[
  'cmr_bank_lines','cmr_bank_statements','cmr_collective_plans','cmr_customer_dunning','cmr_documents',
  'cmr_email_log','cmr_email_templates','cmr_item_categories','cmr_items','cmr_job_runs','cmr_number_ranges',
  'cmr_payments','cmr_pdf_templates','cmr_portal_tokens','cmr_projects','cmr_recurring_plans','cmr_settings','cmr_time_entries',
  'med_compliance_docs','med_documents','med_item_categories','med_items','med_number_ranges','med_payments',
  'commission_payments','commission_rule_mandants','commission_rules','commission_settings','commission_statements'
];
DECLARE src_tables text[] := ARRAY[
  'deleted_customers','email_send_log','suppressed_emails','order_import_logs',
  'recurring_prenotifications','royalty_transactions','zoho_estimate_import_logs'
];
BEGIN
  FOREACH t IN ARRAY id_tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_data_scope_select ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_data_scope_write ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_data_scope_delete ON public.%I', t);
    EXECUTE format('CREATE POLICY tenant_data_scope_select ON public.%I AS RESTRICTIVE FOR SELECT USING (public.tenant_scope_id_ok(tenant_id))', t);
    EXECUTE format('CREATE POLICY tenant_data_scope_write ON public.%I AS RESTRICTIVE FOR ALL USING (public.tenant_scope_id_ok(tenant_id)) WITH CHECK (public.tenant_scope_id_ok(tenant_id))', t);
    EXECUTE format('CREATE POLICY tenant_data_scope_delete ON public.%I AS RESTRICTIVE FOR DELETE USING (public.tenant_scope_id_ok(tenant_id))', t);
  END LOOP;

  FOREACH t IN ARRAY src_tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_data_scope_select ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_data_scope_write ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_data_scope_delete ON public.%I', t);
    EXECUTE format('CREATE POLICY tenant_data_scope_select ON public.%I AS RESTRICTIVE FOR SELECT USING (public.tenant_scope_ok(source_system))', t);
    EXECUTE format('CREATE POLICY tenant_data_scope_write ON public.%I AS RESTRICTIVE FOR ALL USING (public.tenant_scope_ok(source_system)) WITH CHECK (public.tenant_scope_ok(source_system))', t);
    EXECUTE format('CREATE POLICY tenant_data_scope_delete ON public.%I AS RESTRICTIVE FOR DELETE USING (public.tenant_scope_ok(source_system))', t);
  END LOOP;
END $$;