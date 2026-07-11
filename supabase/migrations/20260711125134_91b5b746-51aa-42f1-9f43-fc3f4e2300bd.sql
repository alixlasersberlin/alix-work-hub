
-- 1) esc_store_departments: replace raw anon SELECT with curated RPC
DROP POLICY IF EXISTS "esc_store_departments public bookable read" ON public.esc_store_departments;
REVOKE SELECT ON public.esc_store_departments FROM anon;

CREATE OR REPLACE FUNCTION public.esc_public_departments()
RETURNS TABLE (id text, data jsonb)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    d.id,
    jsonb_build_object(
      'id', d.data->>'id',
      'name', d.data->>'name',
      'color', d.data->>'color',
      'icon', d.data->>'icon',
      'description', d.data->>'description',
      'active', COALESCE((d.data->>'active')::boolean, false),
      'publicBookable', COALESCE((d.data->>'publicBookable')::boolean, false),
      'externallyBookable', COALESCE((d.data->>'externallyBookable')::boolean, false),
      'defaultDurationMinutes', COALESCE((d.data->>'defaultDurationMinutes')::int, 60)
    ) AS data
  FROM public.esc_store_departments d
  WHERE COALESCE((d.data->>'active')::boolean, false) = true
    AND COALESCE((d.data->>'publicBookable')::boolean, false) = true
    AND COALESCE((d.data->>'externallyBookable')::boolean, false) = true;
$$;

GRANT EXECUTE ON FUNCTION public.esc_public_departments() TO anon, authenticated;

-- 2) Finance tables: remove tenant NULL bypass in RLS policies
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'finance_accounts','finance_contracts','finance_reminders','finance_reminder_items',
    'finance_history','finance_bank_statements','finance_bank_lines','finance_bank_postings',
    'finance_sepa_mandates','finance_sepa_runs','finance_sepa_run_items',
    'finance_cashbook','finance_cashbook_closures',
    'finance_deposits','finance_deposit_bookings','finance_deposit_history','finance_deposit_notifications',
    'finance_transactions','finance_incoming_invoices','finance_journal',
    'finance_audit_trail','finance_purchase_orders','finance_purchase_order_items',
    'finance_purchase_requisitions','finance_purchase_requisition_items',
    'finance_assets','finance_asset_depreciations','finance_budgets','finance_forecasts',
    'finance_reports','finance_report_schedules','finance_management_packs',
    'finance_year_end_runs','finance_tax_filings','finance_tax_filing_lines',
    'finance_liquidity_entries','finance_cashflow_plans','finance_cashflow_items',
    'finance_consolidation_runs','finance_consolidation_items',
    'finance_intercompany_matches','finance_intercompany_relations',
    'finance_bank_accounts','finance_fx_rates','finance_goods_receipts',
    'finance_three_way_matches','finance_payment_approvals','finance_approvals',
    'finance_ai_insights','finance_anomalies','finance_automation_runs','finance_automations',
    'finance_stakeholders','finance_stakeholder_access_logs','finance_documents','finance_records'
  ];
  pol record;
  new_qual text;
  new_check text;
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN CONTINUE; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=t AND column_name='tenant_id') THEN CONTINUE; END IF;

    FOR pol IN
      SELECT policyname, cmd, qual, with_check
        FROM pg_policies
       WHERE schemaname='public' AND tablename=t
    LOOP
      new_qual := pol.qual;
      new_check := pol.with_check;
      IF new_qual IS NOT NULL AND position('tenant_id IS NULL' in new_qual) > 0 THEN
        new_qual := replace(new_qual, '((tenant_id IS NULL) OR has_tenant_access(tenant_id))',
                            '(is_admin() OR (tenant_id IS NOT NULL AND has_tenant_access(tenant_id)))');
      END IF;
      IF new_check IS NOT NULL AND position('tenant_id IS NULL' in new_check) > 0 THEN
        new_check := replace(new_check, '((tenant_id IS NULL) OR has_tenant_access(tenant_id))',
                             '(is_admin() OR (tenant_id IS NOT NULL AND has_tenant_access(tenant_id)))');
      END IF;

      IF new_qual IS DISTINCT FROM pol.qual OR new_check IS DISTINCT FROM pol.with_check THEN
        EXECUTE format('DROP POLICY %I ON public.%I', pol.policyname, t);
        EXECUTE format(
          'CREATE POLICY %I ON public.%I FOR %s %s %s',
          pol.policyname, t, pol.cmd,
          CASE WHEN new_qual IS NOT NULL THEN 'USING (' || new_qual || ')' ELSE '' END,
          CASE WHEN new_check IS NOT NULL THEN 'WITH CHECK (' || new_check || ')' ELSE '' END
        );
      END IF;
    END LOOP;
  END LOOP;
END $$;
