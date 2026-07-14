
-- customer_bank_details: retarget public->authenticated
DROP POLICY IF EXISTS "finance roles insert customer bank details" ON public.customer_bank_details;
DROP POLICY IF EXISTS "finance roles read customer bank details" ON public.customer_bank_details;
DROP POLICY IF EXISTS "finance roles update customer bank details" ON public.customer_bank_details;

CREATE POLICY "finance roles insert customer bank details"
ON public.customer_bank_details FOR INSERT TO authenticated
WITH CHECK ((can_access_finance() OR has_role('Finanzierungen'::text)) AND (has_role('Super Admin'::text) OR (EXISTS (SELECT 1 FROM customers c WHERE c.id = customer_bank_details.customer_id AND c.contact_tenant_id IS NOT NULL AND has_tenant_access(c.contact_tenant_id)))));

CREATE POLICY "finance roles read customer bank details"
ON public.customer_bank_details FOR SELECT TO authenticated
USING ((can_access_finance() OR has_role('Finanzierungen'::text)) AND (has_role('Super Admin'::text) OR (EXISTS (SELECT 1 FROM customers c WHERE c.id = customer_bank_details.customer_id AND c.contact_tenant_id IS NOT NULL AND has_tenant_access(c.contact_tenant_id)))));

CREATE POLICY "finance roles update customer bank details"
ON public.customer_bank_details FOR UPDATE TO authenticated
USING ((can_access_finance() OR has_role('Finanzierungen'::text)) AND (has_role('Super Admin'::text) OR (EXISTS (SELECT 1 FROM customers c WHERE c.id = customer_bank_details.customer_id AND c.contact_tenant_id IS NOT NULL AND has_tenant_access(c.contact_tenant_id)))))
WITH CHECK ((can_access_finance() OR has_role('Finanzierungen'::text)) AND (has_role('Super Admin'::text) OR (EXISTS (SELECT 1 FROM customers c WHERE c.id = customer_bank_details.customer_id AND c.contact_tenant_id IS NOT NULL AND has_tenant_access(c.contact_tenant_id)))));

-- finance_approvals: retarget UPDATE
DROP POLICY IF EXISTS "approvals_update" ON public.finance_approvals;
CREATE POLICY "approvals_update"
ON public.finance_approvals FOR UPDATE TO authenticated
USING (can_access_finance() OR has_role('Geschäftsführung'::text))
WITH CHECK ((can_access_finance() OR has_role('Geschäftsführung'::text))
  AND (approved_by IS NULL OR approved_by <> requested_by)
  AND (second_approver_id IS NULL OR (second_approver_id <> requested_by AND (approved_by IS NULL OR second_approver_id <> approved_by))));

-- finance_payment_approvals: retarget UPDATE
DROP POLICY IF EXISTS "fpa_update" ON public.finance_payment_approvals;
CREATE POLICY "fpa_update"
ON public.finance_payment_approvals FOR UPDATE TO authenticated
USING (is_admin() OR can_access_finance() OR has_role('Geschäftsführung'::text))
WITH CHECK ((is_admin() OR can_access_finance() OR has_role('Geschäftsführung'::text))
  AND (approved_by IS NULL OR approved_by <> requested_by));

-- zoho_* SELECT policies: retarget public->authenticated
DROP POLICY IF EXISTS "finance can read zoho invoices" ON public.zoho_invoices;
CREATE POLICY "finance can read zoho invoices"
ON public.zoho_invoices FOR SELECT TO authenticated
USING (can_access_finance() AND (has_role('Super Admin'::text) OR (tenant_id IS NOT NULL AND has_tenant_access(tenant_id))));

DROP POLICY IF EXISTS "finance can read recurring invoices" ON public.zoho_recurring_invoices;
CREATE POLICY "finance can read recurring invoices"
ON public.zoho_recurring_invoices FOR SELECT TO authenticated
USING (can_access_finance() AND (has_role('Super Admin'::text) OR (tenant_id IS NOT NULL AND has_tenant_access(tenant_id))));

DROP POLICY IF EXISTS "finance can read recurring profiles" ON public.zoho_recurring_profiles;
CREATE POLICY "finance can read recurring profiles"
ON public.zoho_recurring_profiles FOR SELECT TO authenticated
USING (can_access_finance() AND (has_role('Super Admin'::text) OR (tenant_id IS NOT NULL AND has_tenant_access(tenant_id))));

DROP POLICY IF EXISTS "finance can read zoho unpaid invoices" ON public.zoho_unpaid_invoices;
CREATE POLICY "finance can read zoho unpaid invoices"
ON public.zoho_unpaid_invoices FOR SELECT TO authenticated
USING (can_access_finance() AND (has_role('Super Admin'::text) OR (tenant_id IS NOT NULL AND has_tenant_access(tenant_id))));
