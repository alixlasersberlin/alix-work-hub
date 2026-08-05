DROP POLICY IF EXISTS "finance can read zoho invoices" ON public.zoho_invoices;
CREATE POLICY "finance can read zoho invoices" ON public.zoho_invoices FOR SELECT TO authenticated
USING ((select public.can_access_finance()) AND ((select public.is_admin()) OR (tenant_id IS NOT NULL AND public.has_tenant_access(tenant_id))));

DROP POLICY IF EXISTS "admins can update zoho invoices" ON public.zoho_invoices;
CREATE POLICY "admins can update zoho invoices" ON public.zoho_invoices FOR UPDATE TO authenticated
USING ((select public.is_admin())) WITH CHECK ((select public.is_admin()));

DROP POLICY IF EXISTS "admins can insert zoho invoices" ON public.zoho_invoices;
CREATE POLICY "admins can insert zoho invoices" ON public.zoho_invoices FOR INSERT TO authenticated
WITH CHECK ((select public.is_admin()));

DROP POLICY IF EXISTS "only super admin can delete" ON public.zoho_invoices;
CREATE POLICY "only super admin can delete" ON public.zoho_invoices FOR DELETE TO authenticated
USING ((select public.has_role('Super Admin')));

DROP POLICY IF EXISTS "finance can read recurring invoices" ON public.zoho_recurring_invoices;
CREATE POLICY "finance can read recurring invoices" ON public.zoho_recurring_invoices FOR SELECT TO authenticated
USING ((select public.can_access_finance()) AND ((select public.has_role('Super Admin')) OR (select public.has_role('Admin')) OR tenant_id IS NULL OR public.has_tenant_access(tenant_id)));

DROP POLICY IF EXISTS "admins can update recurring invoices" ON public.zoho_recurring_invoices;
CREATE POLICY "admins can update recurring invoices" ON public.zoho_recurring_invoices FOR UPDATE TO authenticated
USING ((select public.is_admin())) WITH CHECK ((select public.is_admin()));

DROP POLICY IF EXISTS "admins can insert recurring invoices" ON public.zoho_recurring_invoices;
CREATE POLICY "admins can insert recurring invoices" ON public.zoho_recurring_invoices FOR INSERT TO authenticated
WITH CHECK ((select public.is_admin()));

DROP POLICY IF EXISTS "only super admin can delete" ON public.zoho_recurring_invoices;
CREATE POLICY "only super admin can delete" ON public.zoho_recurring_invoices FOR DELETE TO authenticated
USING ((select public.has_role('Super Admin')));

CREATE INDEX IF NOT EXISTS idx_zri_mietkauf_currency_date ON public.zoho_recurring_invoices (is_mietkauf, currency, invoice_date DESC);