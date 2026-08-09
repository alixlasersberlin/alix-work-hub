DO $$
DECLARE t text;
DECLARE tables text[] := ARRAY[
  'ac_analytics_events','ac_automation_rules','ac_channels','ac_contacts','ac_conversations','ac_messages',
  'ac_web_alerts','ac_web_experiments','ac_web_funnels','ac_web_goals','ac_web_segments','ac_websites',
  'alixsmart_customer_links','alixsmart_device_links','alixsmart_match_logs','alixsmart_registration_invites','alixsmart_reminders',
  'as_cases','media_packages','sig_documents','surveys','survey_design_templates','brand_registry',
  'mdr_vigilance_reports','license_rates','license_settings','zoho_unpaid_invoices'
];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_data_scope_select ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_data_scope_write ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_data_scope_delete ON public.%I', t);
    EXECUTE format('CREATE POLICY tenant_data_scope_select ON public.%I AS RESTRICTIVE FOR SELECT USING (public.tenant_scope_id_ok(tenant_id))', t);
    EXECUTE format('CREATE POLICY tenant_data_scope_write ON public.%I AS RESTRICTIVE FOR ALL USING (public.tenant_scope_id_ok(tenant_id)) WITH CHECK (public.tenant_scope_id_ok(tenant_id))', t);
    EXECUTE format('CREATE POLICY tenant_data_scope_delete ON public.%I AS RESTRICTIVE FOR DELETE USING (public.tenant_scope_id_ok(tenant_id))', t);
  END LOOP;
END $$;