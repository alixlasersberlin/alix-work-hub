
-- 1) Restrict SELECT on catalog_branches to Finance/Admin/Super Admin/Katalog roles (contains bank_details)
DROP POLICY IF EXISTS cat_branch_read ON public.catalog_branches;
CREATE POLICY cat_branch_read ON public.catalog_branches
FOR SELECT TO authenticated
USING (
  has_role('Super Admin') OR has_role('Admin') OR has_role('Katalog') OR has_role('Finance')
);

-- 2) Tighten permissive INSERT policy on catalog_portal_checkouts
DROP POLICY IF EXISTS checkout_insert_auth ON public.catalog_portal_checkouts;
CREATE POLICY checkout_insert_auth ON public.catalog_portal_checkouts
FOR INSERT TO authenticated
WITH CHECK (
  has_role('Super Admin') OR has_role('Admin') OR has_role('Katalog') OR has_role('Order')
  OR portal_user_id IN (
    SELECT id FROM public.customer_portal_users WHERE user_id = auth.uid()
  )
);
