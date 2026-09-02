DROP POLICY IF EXISTS "only super admin can delete" ON public.zoho_invoices;
CREATE POLICY "super admin or buchhaltung admin can delete"
ON public.zoho_invoices FOR DELETE
USING ((SELECT public.has_role('Super Admin')) OR (SELECT public.has_role('Buchhaltung Admin')));

DROP POLICY IF EXISTS "only super admin can delete" ON public.zoho_recurring_invoices;
CREATE POLICY "super admin or buchhaltung admin can delete"
ON public.zoho_recurring_invoices FOR DELETE
USING ((SELECT public.has_role('Super Admin')) OR (SELECT public.has_role('Buchhaltung Admin')));