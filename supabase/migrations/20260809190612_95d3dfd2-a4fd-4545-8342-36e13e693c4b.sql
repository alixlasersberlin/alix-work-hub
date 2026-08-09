DO $$
DECLARE t text;
DECLARE tables text[] := ARRAY[
  'bank_accounts','bank_audit_log','bank_import_templates','bank_imports','bank_return_debits',
  'finance_accounts','finance_ai_insights','finance_anomalies','finance_approvals','finance_assets',
  'finance_automations','finance_bank_accounts','finance_bank_lines','finance_bank_postings','finance_bank_statements',
  'finance_budgets','finance_cashbook','finance_cashbook_closures','finance_cashflow_plans','finance_consolidation_items',
  'finance_contracts','finance_deposit_bookings','finance_deposit_history','finance_deposit_notifications','finance_deposits',
  'finance_forecasts','finance_history','finance_incoming_invoices','finance_journal','finance_liquidity_entries',
  'finance_management_packs','finance_payment_approvals','finance_purchase_orders','finance_purchase_requisitions',
  'finance_reminder_items','finance_reminders','finance_report_schedules','finance_reports',
  'finance_sepa_mandates','finance_sepa_run_items','finance_sepa_runs','finance_stakeholders',
  'finance_tax_filings','finance_tax_payments','finance_transactions','finance_withholding_tax','finance_year_end_runs'
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