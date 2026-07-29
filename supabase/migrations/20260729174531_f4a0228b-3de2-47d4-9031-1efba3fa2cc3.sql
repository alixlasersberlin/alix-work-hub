
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'finance_anomalies','finance_audit_trail','finance_ai_insights',
    'finance_year_end_runs','finance_tax_filings','finance_intercompany_relations',
    'finance_bank_accounts','finance_liquidity_entries','finance_payment_approvals',
    'finance_purchase_requisitions','finance_purchase_orders','finance_goods_receipts',
    'finance_three_way_matches','finance_reports','finance_report_schedules',
    'finance_automations','finance_automation_runs','finance_management_packs'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS accounting_region public.accounting_region NOT NULL DEFAULT ''EU''', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I(accounting_region)', 'idx_'||t||'_region', t);
  END LOOP;
END$$;
