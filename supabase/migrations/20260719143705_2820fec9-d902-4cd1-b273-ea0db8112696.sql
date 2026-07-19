
-- finance_budgets
DROP POLICY IF EXISTS fb_sel ON public.finance_budgets;
DROP POLICY IF EXISTS fb_ins ON public.finance_budgets;
DROP POLICY IF EXISTS fb_upd ON public.finance_budgets;
CREATE POLICY fb_sel ON public.finance_budgets FOR SELECT
  USING ((is_admin() OR has_role('Finance') OR has_role('Geschäftsführung')) AND (tenant_id IS NULL OR has_tenant_access(tenant_id)));
CREATE POLICY fb_ins ON public.finance_budgets FOR INSERT
  WITH CHECK ((is_admin() OR has_role('Finance')) AND (tenant_id IS NULL OR has_tenant_access(tenant_id)));
CREATE POLICY fb_upd ON public.finance_budgets FOR UPDATE
  USING ((is_admin() OR has_role('Finance')) AND (tenant_id IS NULL OR has_tenant_access(tenant_id)))
  WITH CHECK ((is_admin() OR has_role('Finance')) AND (tenant_id IS NULL OR has_tenant_access(tenant_id)));

-- finance_forecasts
DROP POLICY IF EXISTS ff_sel ON public.finance_forecasts;
DROP POLICY IF EXISTS ff_ins ON public.finance_forecasts;
DROP POLICY IF EXISTS ff_upd ON public.finance_forecasts;
CREATE POLICY ff_sel ON public.finance_forecasts FOR SELECT
  USING ((is_admin() OR has_role('Finance') OR has_role('Geschäftsführung')) AND (tenant_id IS NULL OR has_tenant_access(tenant_id)));
CREATE POLICY ff_ins ON public.finance_forecasts FOR INSERT
  WITH CHECK ((is_admin() OR has_role('Finance')) AND (tenant_id IS NULL OR has_tenant_access(tenant_id)));
CREATE POLICY ff_upd ON public.finance_forecasts FOR UPDATE
  USING ((is_admin() OR has_role('Finance')) AND (tenant_id IS NULL OR has_tenant_access(tenant_id)))
  WITH CHECK ((is_admin() OR has_role('Finance')) AND (tenant_id IS NULL OR has_tenant_access(tenant_id)));

-- finance_approvals
DROP POLICY IF EXISTS approvals_read ON public.finance_approvals;
DROP POLICY IF EXISTS approvals_insert ON public.finance_approvals;
DROP POLICY IF EXISTS approvals_update ON public.finance_approvals;
CREATE POLICY approvals_read ON public.finance_approvals FOR SELECT
  USING ((can_access_finance() OR has_role('Geschäftsführung')) AND (tenant_id IS NULL OR has_tenant_access(tenant_id)));
CREATE POLICY approvals_insert ON public.finance_approvals FOR INSERT
  WITH CHECK (can_access_finance() AND (tenant_id IS NULL OR has_tenant_access(tenant_id)));
CREATE POLICY approvals_update ON public.finance_approvals FOR UPDATE
  USING ((can_access_finance() OR has_role('Geschäftsführung')) AND (tenant_id IS NULL OR has_tenant_access(tenant_id)))
  WITH CHECK (
    (can_access_finance() OR has_role('Geschäftsführung'))
    AND (tenant_id IS NULL OR has_tenant_access(tenant_id))
    AND ((approved_by IS NULL) OR (approved_by <> requested_by))
    AND ((second_approver_id IS NULL) OR ((second_approver_id <> requested_by) AND ((approved_by IS NULL) OR (second_approver_id <> approved_by))))
  );

-- finance_automations
DROP POLICY IF EXISTS finance_automations_read ON public.finance_automations;
DROP POLICY IF EXISTS finance_automations_insert ON public.finance_automations;
DROP POLICY IF EXISTS finance_automations_update ON public.finance_automations;
CREATE POLICY finance_automations_read ON public.finance_automations FOR SELECT
  USING ((can_access_finance() OR has_role('Geschäftsführung')) AND (tenant_id IS NULL OR has_tenant_access(tenant_id)));
CREATE POLICY finance_automations_insert ON public.finance_automations FOR INSERT
  WITH CHECK (is_admin() AND (tenant_id IS NULL OR has_tenant_access(tenant_id)));
CREATE POLICY finance_automations_update ON public.finance_automations FOR UPDATE
  USING (is_admin() AND (tenant_id IS NULL OR has_tenant_access(tenant_id)))
  WITH CHECK (is_admin() AND (tenant_id IS NULL OR has_tenant_access(tenant_id)));

-- finance_automation_runs
DROP POLICY IF EXISTS automation_runs_read ON public.finance_automation_runs;
DROP POLICY IF EXISTS automation_runs_insert ON public.finance_automation_runs;
CREATE POLICY automation_runs_read ON public.finance_automation_runs FOR SELECT
  USING ((can_access_finance() OR has_role('Geschäftsführung'))
    AND EXISTS (SELECT 1 FROM public.finance_automations a WHERE a.id = finance_automation_runs.automation_id AND (a.tenant_id IS NULL OR has_tenant_access(a.tenant_id))));
CREATE POLICY automation_runs_insert ON public.finance_automation_runs FOR INSERT
  WITH CHECK (is_admin()
    AND EXISTS (SELECT 1 FROM public.finance_automations a WHERE a.id = finance_automation_runs.automation_id AND (a.tenant_id IS NULL OR has_tenant_access(a.tenant_id))));

-- finance_cashflow_plans
DROP POLICY IF EXISTS fcp_select ON public.finance_cashflow_plans;
DROP POLICY IF EXISTS fcp_insert ON public.finance_cashflow_plans;
DROP POLICY IF EXISTS fcp_update ON public.finance_cashflow_plans;
CREATE POLICY fcp_select ON public.finance_cashflow_plans FOR SELECT
  USING ((is_admin() OR has_role('Finance') OR has_role('Geschäftsführung')) AND (tenant_id IS NULL OR has_tenant_access(tenant_id)));
CREATE POLICY fcp_insert ON public.finance_cashflow_plans FOR INSERT
  WITH CHECK ((is_admin() OR has_role('Finance')) AND (tenant_id IS NULL OR has_tenant_access(tenant_id)));
CREATE POLICY fcp_update ON public.finance_cashflow_plans FOR UPDATE
  USING ((is_admin() OR has_role('Finance')) AND (tenant_id IS NULL OR has_tenant_access(tenant_id)))
  WITH CHECK ((is_admin() OR has_role('Finance')) AND (tenant_id IS NULL OR has_tenant_access(tenant_id)));

-- finance_cashflow_items
DROP POLICY IF EXISTS fci_select ON public.finance_cashflow_items;
DROP POLICY IF EXISTS fci_insert ON public.finance_cashflow_items;
DROP POLICY IF EXISTS fci_update ON public.finance_cashflow_items;
CREATE POLICY fci_select ON public.finance_cashflow_items FOR SELECT
  USING ((is_admin() OR has_role('Finance') OR has_role('Geschäftsführung'))
    AND EXISTS (SELECT 1 FROM public.finance_cashflow_plans p WHERE p.id = finance_cashflow_items.plan_id AND (p.tenant_id IS NULL OR has_tenant_access(p.tenant_id))));
CREATE POLICY fci_insert ON public.finance_cashflow_items FOR INSERT
  WITH CHECK ((is_admin() OR has_role('Finance'))
    AND EXISTS (SELECT 1 FROM public.finance_cashflow_plans p WHERE p.id = finance_cashflow_items.plan_id AND (p.tenant_id IS NULL OR has_tenant_access(p.tenant_id))));
CREATE POLICY fci_update ON public.finance_cashflow_items FOR UPDATE
  USING ((is_admin() OR has_role('Finance'))
    AND EXISTS (SELECT 1 FROM public.finance_cashflow_plans p WHERE p.id = finance_cashflow_items.plan_id AND (p.tenant_id IS NULL OR has_tenant_access(p.tenant_id))))
  WITH CHECK ((is_admin() OR has_role('Finance'))
    AND EXISTS (SELECT 1 FROM public.finance_cashflow_plans p WHERE p.id = finance_cashflow_items.plan_id AND (p.tenant_id IS NULL OR has_tenant_access(p.tenant_id))));

-- finance_management_packs
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='finance_management_packs' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.finance_management_packs', r.policyname);
  END LOOP;
END $$;
CREATE POLICY fmp_select ON public.finance_management_packs FOR SELECT
  USING ((is_admin() OR has_role('Finance') OR has_role('Geschäftsführung')) AND (tenant_id IS NULL OR has_tenant_access(tenant_id)));
CREATE POLICY fmp_insert ON public.finance_management_packs FOR INSERT
  WITH CHECK ((is_admin() OR has_role('Finance')) AND (tenant_id IS NULL OR has_tenant_access(tenant_id)));
CREATE POLICY fmp_update ON public.finance_management_packs FOR UPDATE
  USING ((is_admin() OR has_role('Finance')) AND (tenant_id IS NULL OR has_tenant_access(tenant_id)))
  WITH CHECK ((is_admin() OR has_role('Finance')) AND (tenant_id IS NULL OR has_tenant_access(tenant_id)));
CREATE POLICY fmp_delete ON public.finance_management_packs FOR DELETE
  USING (has_role('Super Admin'));

-- finance_reports
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='finance_reports' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.finance_reports', r.policyname);
  END LOOP;
END $$;
CREATE POLICY freports_select ON public.finance_reports FOR SELECT
  USING ((is_admin() OR has_role('Finance') OR has_role('Geschäftsführung')) AND (tenant_id IS NULL OR has_tenant_access(tenant_id)));
CREATE POLICY freports_insert ON public.finance_reports FOR INSERT
  WITH CHECK ((is_admin() OR has_role('Finance')) AND (tenant_id IS NULL OR has_tenant_access(tenant_id)));
CREATE POLICY freports_update ON public.finance_reports FOR UPDATE
  USING ((is_admin() OR has_role('Finance')) AND (tenant_id IS NULL OR has_tenant_access(tenant_id)))
  WITH CHECK ((is_admin() OR has_role('Finance')) AND (tenant_id IS NULL OR has_tenant_access(tenant_id)));
CREATE POLICY freports_delete ON public.finance_reports FOR DELETE
  USING (has_role('Super Admin'));

-- finance_report_schedules
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='finance_report_schedules' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.finance_report_schedules', r.policyname);
  END LOOP;
END $$;
CREATE POLICY frs_select ON public.finance_report_schedules FOR SELECT
  USING ((is_admin() OR has_role('Finance') OR has_role('Geschäftsführung')) AND (tenant_id IS NULL OR has_tenant_access(tenant_id)));
CREATE POLICY frs_insert ON public.finance_report_schedules FOR INSERT
  WITH CHECK ((is_admin() OR has_role('Finance')) AND (tenant_id IS NULL OR has_tenant_access(tenant_id)));
CREATE POLICY frs_update ON public.finance_report_schedules FOR UPDATE
  USING ((is_admin() OR has_role('Finance')) AND (tenant_id IS NULL OR has_tenant_access(tenant_id)))
  WITH CHECK ((is_admin() OR has_role('Finance')) AND (tenant_id IS NULL OR has_tenant_access(tenant_id)));
CREATE POLICY frs_delete ON public.finance_report_schedules FOR DELETE
  USING (has_role('Super Admin'));

-- finance_purchase_requisitions
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='finance_purchase_requisitions' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.finance_purchase_requisitions', r.policyname);
  END LOOP;
END $$;
CREATE POLICY fpr_select ON public.finance_purchase_requisitions FOR SELECT
  USING ((is_admin() OR can_access_finance() OR has_role('Geschäftsführung')) AND (tenant_id IS NULL OR has_tenant_access(tenant_id)));
CREATE POLICY fpr_insert ON public.finance_purchase_requisitions FOR INSERT
  WITH CHECK ((is_admin() OR can_access_finance()) AND (tenant_id IS NULL OR has_tenant_access(tenant_id)));
CREATE POLICY fpr_update ON public.finance_purchase_requisitions FOR UPDATE
  USING ((is_admin() OR can_access_finance()) AND (tenant_id IS NULL OR has_tenant_access(tenant_id)))
  WITH CHECK ((is_admin() OR can_access_finance()) AND (tenant_id IS NULL OR has_tenant_access(tenant_id)));
CREATE POLICY fpr_delete ON public.finance_purchase_requisitions FOR DELETE
  USING (has_role('Super Admin'));

-- finance_purchase_requisition_items
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='finance_purchase_requisition_items' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.finance_purchase_requisition_items', r.policyname);
  END LOOP;
END $$;
CREATE POLICY fpri_select ON public.finance_purchase_requisition_items FOR SELECT
  USING ((is_admin() OR can_access_finance() OR has_role('Geschäftsführung'))
    AND EXISTS (SELECT 1 FROM public.finance_purchase_requisitions p WHERE p.id = finance_purchase_requisition_items.requisition_id AND (p.tenant_id IS NULL OR has_tenant_access(p.tenant_id))));
CREATE POLICY fpri_insert ON public.finance_purchase_requisition_items FOR INSERT
  WITH CHECK ((is_admin() OR can_access_finance())
    AND EXISTS (SELECT 1 FROM public.finance_purchase_requisitions p WHERE p.id = finance_purchase_requisition_items.requisition_id AND (p.tenant_id IS NULL OR has_tenant_access(p.tenant_id))));
CREATE POLICY fpri_update ON public.finance_purchase_requisition_items FOR UPDATE
  USING ((is_admin() OR can_access_finance())
    AND EXISTS (SELECT 1 FROM public.finance_purchase_requisitions p WHERE p.id = finance_purchase_requisition_items.requisition_id AND (p.tenant_id IS NULL OR has_tenant_access(p.tenant_id))))
  WITH CHECK ((is_admin() OR can_access_finance())
    AND EXISTS (SELECT 1 FROM public.finance_purchase_requisitions p WHERE p.id = finance_purchase_requisition_items.requisition_id AND (p.tenant_id IS NULL OR has_tenant_access(p.tenant_id))));
CREATE POLICY fpri_delete ON public.finance_purchase_requisition_items FOR DELETE
  USING (has_role('Super Admin'));

-- finance_purchase_orders
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='finance_purchase_orders' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.finance_purchase_orders', r.policyname);
  END LOOP;
END $$;
CREATE POLICY fpo_select ON public.finance_purchase_orders FOR SELECT
  USING ((is_admin() OR can_access_finance() OR has_role('Geschäftsführung')) AND (tenant_id IS NULL OR has_tenant_access(tenant_id)));
CREATE POLICY fpo_insert ON public.finance_purchase_orders FOR INSERT
  WITH CHECK ((is_admin() OR can_access_finance()) AND (tenant_id IS NULL OR has_tenant_access(tenant_id)));
CREATE POLICY fpo_update ON public.finance_purchase_orders FOR UPDATE
  USING ((is_admin() OR can_access_finance()) AND (tenant_id IS NULL OR has_tenant_access(tenant_id)))
  WITH CHECK ((is_admin() OR can_access_finance()) AND (tenant_id IS NULL OR has_tenant_access(tenant_id)));
CREATE POLICY fpo_delete ON public.finance_purchase_orders FOR DELETE
  USING (has_role('Super Admin'));

-- finance_purchase_order_items (parent via po_id)
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='finance_purchase_order_items' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.finance_purchase_order_items', r.policyname);
  END LOOP;
END $$;
CREATE POLICY fpoi_select ON public.finance_purchase_order_items FOR SELECT
  USING ((is_admin() OR can_access_finance() OR has_role('Geschäftsführung'))
    AND EXISTS (SELECT 1 FROM public.finance_purchase_orders p WHERE p.id = finance_purchase_order_items.po_id AND (p.tenant_id IS NULL OR has_tenant_access(p.tenant_id))));
CREATE POLICY fpoi_insert ON public.finance_purchase_order_items FOR INSERT
  WITH CHECK ((is_admin() OR can_access_finance())
    AND EXISTS (SELECT 1 FROM public.finance_purchase_orders p WHERE p.id = finance_purchase_order_items.po_id AND (p.tenant_id IS NULL OR has_tenant_access(p.tenant_id))));
CREATE POLICY fpoi_update ON public.finance_purchase_order_items FOR UPDATE
  USING ((is_admin() OR can_access_finance())
    AND EXISTS (SELECT 1 FROM public.finance_purchase_orders p WHERE p.id = finance_purchase_order_items.po_id AND (p.tenant_id IS NULL OR has_tenant_access(p.tenant_id))))
  WITH CHECK ((is_admin() OR can_access_finance())
    AND EXISTS (SELECT 1 FROM public.finance_purchase_orders p WHERE p.id = finance_purchase_order_items.po_id AND (p.tenant_id IS NULL OR has_tenant_access(p.tenant_id))));
CREATE POLICY fpoi_delete ON public.finance_purchase_order_items FOR DELETE
  USING (has_role('Super Admin'));

-- finance_goods_receipts (parent via po_id)
DROP POLICY IF EXISTS fgr_select ON public.finance_goods_receipts;
DROP POLICY IF EXISTS fgr_insert ON public.finance_goods_receipts;
DROP POLICY IF EXISTS fgr_update ON public.finance_goods_receipts;
CREATE POLICY fgr_select ON public.finance_goods_receipts FOR SELECT
  USING ((is_admin() OR can_access_finance() OR has_role('Geschäftsführung'))
    AND (po_id IS NULL OR EXISTS (SELECT 1 FROM public.finance_purchase_orders p WHERE p.id = finance_goods_receipts.po_id AND (p.tenant_id IS NULL OR has_tenant_access(p.tenant_id)))));
CREATE POLICY fgr_insert ON public.finance_goods_receipts FOR INSERT
  WITH CHECK ((is_admin() OR can_access_finance() OR has_role('Geschäftsführung'))
    AND (po_id IS NULL OR EXISTS (SELECT 1 FROM public.finance_purchase_orders p WHERE p.id = finance_goods_receipts.po_id AND (p.tenant_id IS NULL OR has_tenant_access(p.tenant_id)))));
CREATE POLICY fgr_update ON public.finance_goods_receipts FOR UPDATE
  USING ((is_admin() OR can_access_finance() OR has_role('Geschäftsführung'))
    AND (po_id IS NULL OR EXISTS (SELECT 1 FROM public.finance_purchase_orders p WHERE p.id = finance_goods_receipts.po_id AND (p.tenant_id IS NULL OR has_tenant_access(p.tenant_id)))));

-- finance_three_way_matches (parent via po_id)
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='finance_three_way_matches' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.finance_three_way_matches', r.policyname);
  END LOOP;
END $$;
CREATE POLICY ftwm_select ON public.finance_three_way_matches FOR SELECT
  USING ((is_admin() OR can_access_finance() OR has_role('Geschäftsführung'))
    AND (po_id IS NULL OR EXISTS (SELECT 1 FROM public.finance_purchase_orders p WHERE p.id = finance_three_way_matches.po_id AND (p.tenant_id IS NULL OR has_tenant_access(p.tenant_id)))));
CREATE POLICY ftwm_insert ON public.finance_three_way_matches FOR INSERT
  WITH CHECK ((is_admin() OR can_access_finance())
    AND (po_id IS NULL OR EXISTS (SELECT 1 FROM public.finance_purchase_orders p WHERE p.id = finance_three_way_matches.po_id AND (p.tenant_id IS NULL OR has_tenant_access(p.tenant_id)))));
CREATE POLICY ftwm_update ON public.finance_three_way_matches FOR UPDATE
  USING ((is_admin() OR can_access_finance())
    AND (po_id IS NULL OR EXISTS (SELECT 1 FROM public.finance_purchase_orders p WHERE p.id = finance_three_way_matches.po_id AND (p.tenant_id IS NULL OR has_tenant_access(p.tenant_id)))))
  WITH CHECK ((is_admin() OR can_access_finance())
    AND (po_id IS NULL OR EXISTS (SELECT 1 FROM public.finance_purchase_orders p WHERE p.id = finance_three_way_matches.po_id AND (p.tenant_id IS NULL OR has_tenant_access(p.tenant_id)))));
CREATE POLICY ftwm_delete ON public.finance_three_way_matches FOR DELETE
  USING (has_role('Super Admin'));

-- finance_tax_filings
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='finance_tax_filings' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.finance_tax_filings', r.policyname);
  END LOOP;
END $$;
CREATE POLICY ftf_select ON public.finance_tax_filings FOR SELECT
  USING ((is_admin() OR can_access_finance() OR has_role('Geschäftsführung')) AND (tenant_id IS NULL OR has_tenant_access(tenant_id)));
CREATE POLICY ftf_insert ON public.finance_tax_filings FOR INSERT
  WITH CHECK ((is_admin() OR can_access_finance()) AND (tenant_id IS NULL OR has_tenant_access(tenant_id)));
CREATE POLICY ftf_update ON public.finance_tax_filings FOR UPDATE
  USING ((is_admin() OR can_access_finance()) AND (tenant_id IS NULL OR has_tenant_access(tenant_id)))
  WITH CHECK ((is_admin() OR can_access_finance()) AND (tenant_id IS NULL OR has_tenant_access(tenant_id)));
CREATE POLICY ftf_delete ON public.finance_tax_filings FOR DELETE
  USING (has_role('Super Admin'));

-- finance_tax_filing_lines
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='finance_tax_filing_lines' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.finance_tax_filing_lines', r.policyname);
  END LOOP;
END $$;
CREATE POLICY ftfl_select ON public.finance_tax_filing_lines FOR SELECT
  USING ((is_admin() OR can_access_finance() OR has_role('Geschäftsführung'))
    AND EXISTS (SELECT 1 FROM public.finance_tax_filings f WHERE f.id = finance_tax_filing_lines.filing_id AND (f.tenant_id IS NULL OR has_tenant_access(f.tenant_id))));
CREATE POLICY ftfl_insert ON public.finance_tax_filing_lines FOR INSERT
  WITH CHECK ((is_admin() OR can_access_finance())
    AND EXISTS (SELECT 1 FROM public.finance_tax_filings f WHERE f.id = finance_tax_filing_lines.filing_id AND (f.tenant_id IS NULL OR has_tenant_access(f.tenant_id))));
CREATE POLICY ftfl_update ON public.finance_tax_filing_lines FOR UPDATE
  USING ((is_admin() OR can_access_finance())
    AND EXISTS (SELECT 1 FROM public.finance_tax_filings f WHERE f.id = finance_tax_filing_lines.filing_id AND (f.tenant_id IS NULL OR has_tenant_access(f.tenant_id))))
  WITH CHECK ((is_admin() OR can_access_finance())
    AND EXISTS (SELECT 1 FROM public.finance_tax_filings f WHERE f.id = finance_tax_filing_lines.filing_id AND (f.tenant_id IS NULL OR has_tenant_access(f.tenant_id))));
CREATE POLICY ftfl_delete ON public.finance_tax_filing_lines FOR DELETE
  USING (has_role('Super Admin'));

-- finance_year_end_runs
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='finance_year_end_runs' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.finance_year_end_runs', r.policyname);
  END LOOP;
END $$;
CREATE POLICY fyer_select ON public.finance_year_end_runs FOR SELECT
  USING ((is_admin() OR can_access_finance() OR has_role('Geschäftsführung')) AND (tenant_id IS NULL OR has_tenant_access(tenant_id)));
CREATE POLICY fyer_insert ON public.finance_year_end_runs FOR INSERT
  WITH CHECK ((is_admin() OR can_access_finance()) AND (tenant_id IS NULL OR has_tenant_access(tenant_id)));
CREATE POLICY fyer_update ON public.finance_year_end_runs FOR UPDATE
  USING ((is_admin() OR can_access_finance()) AND (tenant_id IS NULL OR has_tenant_access(tenant_id)))
  WITH CHECK ((is_admin() OR can_access_finance()) AND (tenant_id IS NULL OR has_tenant_access(tenant_id)));
CREATE POLICY fyer_delete ON public.finance_year_end_runs FOR DELETE
  USING (has_role('Super Admin'));

-- sig_documents: remove JWT email match
DROP POLICY IF EXISTS sig_documents_select ON public.sig_documents;
CREATE POLICY sig_documents_select ON public.sig_documents FOR SELECT
  USING (sig_is_admin() OR (created_by = auth.uid()));
