DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'finance_assets','finance_budgets','finance_forecasts',
    'finance_cashflow_plans','finance_cashflow_items',
    'finance_incoming_invoices','finance_documents','finance_approvals'
  ] LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS accounting_region public.accounting_region NOT NULL DEFAULT ''EU''',
      t
    );
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON public.%I (accounting_region)',
      'idx_'||t||'_region', t
    );
  END LOOP;
END $$;