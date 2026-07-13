
-- 1) customer_bank_details: add tenant scoping via customers.contact_tenant_id
DROP POLICY IF EXISTS "finance roles read customer bank details" ON public.customer_bank_details;
DROP POLICY IF EXISTS "finance roles insert customer bank details" ON public.customer_bank_details;
DROP POLICY IF EXISTS "finance roles update customer bank details" ON public.customer_bank_details;

CREATE POLICY "finance roles read customer bank details"
ON public.customer_bank_details FOR SELECT
USING (
  (can_access_finance() OR has_role('Finanzierungen'::text))
  AND (
    has_role('Super Admin'::text)
    OR EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = customer_bank_details.customer_id
        AND (c.contact_tenant_id IS NOT NULL AND has_tenant_access(c.contact_tenant_id))
    )
  )
);

CREATE POLICY "finance roles insert customer bank details"
ON public.customer_bank_details FOR INSERT
WITH CHECK (
  (can_access_finance() OR has_role('Finanzierungen'::text))
  AND (
    has_role('Super Admin'::text)
    OR EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = customer_bank_details.customer_id
        AND (c.contact_tenant_id IS NOT NULL AND has_tenant_access(c.contact_tenant_id))
    )
  )
);

CREATE POLICY "finance roles update customer bank details"
ON public.customer_bank_details FOR UPDATE
USING (
  (can_access_finance() OR has_role('Finanzierungen'::text))
  AND (
    has_role('Super Admin'::text)
    OR EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = customer_bank_details.customer_id
        AND (c.contact_tenant_id IS NOT NULL AND has_tenant_access(c.contact_tenant_id))
    )
  )
)
WITH CHECK (
  (can_access_finance() OR has_role('Finanzierungen'::text))
  AND (
    has_role('Super Admin'::text)
    OR EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = customer_bank_details.customer_id
        AND (c.contact_tenant_id IS NOT NULL AND has_tenant_access(c.contact_tenant_id))
    )
  )
);

-- 2) Remove NULL-tenant fallback on zoho_* tables (Super Admin retains access)
DROP POLICY IF EXISTS "finance can read zoho invoices" ON public.zoho_invoices;
CREATE POLICY "finance can read zoho invoices"
ON public.zoho_invoices FOR SELECT
USING (
  can_access_finance()
  AND (has_role('Super Admin'::text) OR (tenant_id IS NOT NULL AND has_tenant_access(tenant_id)))
);

DROP POLICY IF EXISTS "finance can read recurring invoices" ON public.zoho_recurring_invoices;
CREATE POLICY "finance can read recurring invoices"
ON public.zoho_recurring_invoices FOR SELECT
USING (
  can_access_finance()
  AND (has_role('Super Admin'::text) OR (tenant_id IS NOT NULL AND has_tenant_access(tenant_id)))
);

DROP POLICY IF EXISTS "finance can read zoho unpaid invoices" ON public.zoho_unpaid_invoices;
CREATE POLICY "finance can read zoho unpaid invoices"
ON public.zoho_unpaid_invoices FOR SELECT
USING (
  can_access_finance()
  AND (has_role('Super Admin'::text) OR (tenant_id IS NOT NULL AND has_tenant_access(tenant_id)))
);

DROP POLICY IF EXISTS "finance can read recurring profiles" ON public.zoho_recurring_profiles;
CREATE POLICY "finance can read recurring profiles"
ON public.zoho_recurring_profiles FOR SELECT
USING (
  can_access_finance()
  AND (has_role('Super Admin'::text) OR (tenant_id IS NOT NULL AND has_tenant_access(tenant_id)))
);
