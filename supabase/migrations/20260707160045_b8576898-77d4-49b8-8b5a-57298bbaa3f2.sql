
CREATE OR REPLACE FUNCTION public.has_tenant_access(_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role('Super Admin')
    OR _tenant_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.user_tenant_access
      WHERE user_id = auth.uid() AND tenant_id = _tenant_id
    );
$$;

GRANT EXECUTE ON FUNCTION public.has_tenant_access(uuid) TO authenticated, service_role;

-- finance_transactions
DROP POLICY IF EXISTS finance_tx_select ON public.finance_transactions;
DROP POLICY IF EXISTS finance_tx_insert ON public.finance_transactions;
DROP POLICY IF EXISTS finance_tx_update ON public.finance_transactions;
CREATE POLICY finance_tx_select ON public.finance_transactions FOR SELECT
  USING (can_view_finance_module() AND has_tenant_access(tenant_id));
CREATE POLICY finance_tx_insert ON public.finance_transactions FOR INSERT
  WITH CHECK (can_access_finance_module() AND has_tenant_access(tenant_id));
CREATE POLICY finance_tx_update ON public.finance_transactions FOR UPDATE
  USING (can_access_finance_module() AND has_tenant_access(tenant_id))
  WITH CHECK (can_access_finance_module() AND has_tenant_access(tenant_id));

-- finance_bank_accounts
DROP POLICY IF EXISTS fba_select ON public.finance_bank_accounts;
DROP POLICY IF EXISTS fba_insert ON public.finance_bank_accounts;
DROP POLICY IF EXISTS fba_update ON public.finance_bank_accounts;
CREATE POLICY fba_select ON public.finance_bank_accounts FOR SELECT
  USING ((is_admin() OR can_access_finance() OR has_role('Geschäftsführung')) AND has_tenant_access(tenant_id));
CREATE POLICY fba_insert ON public.finance_bank_accounts FOR INSERT
  WITH CHECK ((is_admin() OR can_access_finance() OR has_role('Geschäftsführung')) AND has_tenant_access(tenant_id));
CREATE POLICY fba_update ON public.finance_bank_accounts FOR UPDATE
  USING ((is_admin() OR can_access_finance() OR has_role('Geschäftsführung')) AND has_tenant_access(tenant_id))
  WITH CHECK ((is_admin() OR can_access_finance() OR has_role('Geschäftsführung')) AND has_tenant_access(tenant_id));

-- finance_assets
DROP POLICY IF EXISTS fa_select ON public.finance_assets;
DROP POLICY IF EXISTS fa_insert ON public.finance_assets;
DROP POLICY IF EXISTS fa_update ON public.finance_assets;
CREATE POLICY fa_select ON public.finance_assets FOR SELECT
  USING ((is_admin() OR has_role('Finance') OR has_role('Geschäftsführung')) AND has_tenant_access(tenant_id));
CREATE POLICY fa_insert ON public.finance_assets FOR INSERT
  WITH CHECK ((is_admin() OR has_role('Finance')) AND has_tenant_access(tenant_id));
CREATE POLICY fa_update ON public.finance_assets FOR UPDATE
  USING ((is_admin() OR has_role('Finance')) AND has_tenant_access(tenant_id))
  WITH CHECK ((is_admin() OR has_role('Finance')) AND has_tenant_access(tenant_id));

-- finance_journal
DROP POLICY IF EXISTS journal_select ON public.finance_journal;
DROP POLICY IF EXISTS journal_insert ON public.finance_journal;
DROP POLICY IF EXISTS journal_update ON public.finance_journal;
CREATE POLICY journal_select ON public.finance_journal FOR SELECT
  USING (can_view_finance_module() AND has_tenant_access(tenant_id));
CREATE POLICY journal_insert ON public.finance_journal FOR INSERT
  WITH CHECK (can_access_finance_module() AND has_tenant_access(tenant_id));
CREATE POLICY journal_update ON public.finance_journal FOR UPDATE
  USING (can_access_finance_module() AND has_tenant_access(tenant_id))
  WITH CHECK (can_access_finance_module() AND has_tenant_access(tenant_id));

-- finance_documents
DROP POLICY IF EXISTS fdocs_select ON public.finance_documents;
DROP POLICY IF EXISTS fdocs_insert ON public.finance_documents;
DROP POLICY IF EXISTS fdocs_update ON public.finance_documents;
CREATE POLICY fdocs_select ON public.finance_documents FOR SELECT
  USING ((is_admin() OR has_role('Finance') OR has_role('Geschäftsführung')) AND has_tenant_access(tenant_id));
CREATE POLICY fdocs_insert ON public.finance_documents FOR INSERT
  WITH CHECK ((is_admin() OR has_role('Finance')) AND has_tenant_access(tenant_id));
CREATE POLICY fdocs_update ON public.finance_documents FOR UPDATE
  USING ((is_admin() OR has_role('Finance')) AND has_tenant_access(tenant_id))
  WITH CHECK ((is_admin() OR has_role('Finance')) AND has_tenant_access(tenant_id));

-- finance_incoming_invoices
DROP POLICY IF EXISTS finc_select ON public.finance_incoming_invoices;
DROP POLICY IF EXISTS finc_insert ON public.finance_incoming_invoices;
DROP POLICY IF EXISTS finc_update ON public.finance_incoming_invoices;
CREATE POLICY finc_select ON public.finance_incoming_invoices FOR SELECT
  USING ((is_admin() OR has_role('Finance') OR has_role('Geschäftsführung')) AND has_tenant_access(tenant_id));
CREATE POLICY finc_insert ON public.finance_incoming_invoices FOR INSERT
  WITH CHECK ((is_admin() OR has_role('Finance')) AND has_tenant_access(tenant_id));
CREATE POLICY finc_update ON public.finance_incoming_invoices FOR UPDATE
  USING ((is_admin() OR has_role('Finance') OR has_role('Geschäftsführung')) AND has_tenant_access(tenant_id))
  WITH CHECK ((is_admin() OR has_role('Finance') OR has_role('Geschäftsführung')) AND has_tenant_access(tenant_id));

-- finance_purchase_orders
DROP POLICY IF EXISTS fpo_select ON public.finance_purchase_orders;
DROP POLICY IF EXISTS fpo_insert ON public.finance_purchase_orders;
DROP POLICY IF EXISTS fpo_update ON public.finance_purchase_orders;
CREATE POLICY fpo_select ON public.finance_purchase_orders FOR SELECT
  USING ((is_admin() OR can_access_finance() OR has_role('Geschäftsführung')) AND has_tenant_access(tenant_id));
CREATE POLICY fpo_insert ON public.finance_purchase_orders FOR INSERT
  WITH CHECK ((is_admin() OR can_access_finance() OR has_role('Geschäftsführung')) AND has_tenant_access(tenant_id));
CREATE POLICY fpo_update ON public.finance_purchase_orders FOR UPDATE
  USING ((is_admin() OR can_access_finance() OR has_role('Geschäftsführung')) AND has_tenant_access(tenant_id))
  WITH CHECK ((is_admin() OR can_access_finance() OR has_role('Geschäftsführung')) AND has_tenant_access(tenant_id));

-- finance_sepa_runs
DROP POLICY IF EXISTS sepa_runs_select ON public.finance_sepa_runs;
DROP POLICY IF EXISTS sepa_runs_insert ON public.finance_sepa_runs;
DROP POLICY IF EXISTS sepa_runs_update ON public.finance_sepa_runs;
CREATE POLICY sepa_runs_select ON public.finance_sepa_runs FOR SELECT
  USING ((is_admin() OR has_role('Finance') OR has_role('Geschäftsführung')) AND has_tenant_access(tenant_id));
CREATE POLICY sepa_runs_insert ON public.finance_sepa_runs FOR INSERT
  WITH CHECK ((is_admin() OR has_role('Finance')) AND has_tenant_access(tenant_id));
CREATE POLICY sepa_runs_update ON public.finance_sepa_runs FOR UPDATE
  USING ((is_admin() OR has_role('Finance')) AND has_tenant_access(tenant_id))
  WITH CHECK ((is_admin() OR has_role('Finance')) AND has_tenant_access(tenant_id));

-- finance_liquidity_entries
DROP POLICY IF EXISTS fle_select ON public.finance_liquidity_entries;
DROP POLICY IF EXISTS fle_insert ON public.finance_liquidity_entries;
DROP POLICY IF EXISTS fle_update ON public.finance_liquidity_entries;
CREATE POLICY fle_select ON public.finance_liquidity_entries FOR SELECT
  USING ((is_admin() OR can_access_finance() OR has_role('Geschäftsführung')) AND has_tenant_access(tenant_id));
CREATE POLICY fle_insert ON public.finance_liquidity_entries FOR INSERT
  WITH CHECK ((is_admin() OR can_access_finance() OR has_role('Geschäftsführung')) AND has_tenant_access(tenant_id));
CREATE POLICY fle_update ON public.finance_liquidity_entries FOR UPDATE
  USING ((is_admin() OR can_access_finance() OR has_role('Geschäftsführung')) AND has_tenant_access(tenant_id))
  WITH CHECK ((is_admin() OR can_access_finance() OR has_role('Geschäftsführung')) AND has_tenant_access(tenant_id));
