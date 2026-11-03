DROP POLICY IF EXISTS "fibu light reads open invoices" ON public.zoho_invoices;
CREATE POLICY "fibu light reads open invoices" ON public.zoho_invoices FOR SELECT TO authenticated
  USING ((SELECT public.is_fibu_light()) AND (COALESCE(balance, 0::numeric) > 0::numeric));

DROP POLICY IF EXISTS cat_items_read ON public.catalog_items;
CREATE POLICY cat_items_read ON public.catalog_items FOR SELECT TO authenticated
  USING ((SELECT (has_role('Super Admin') OR has_role('Admin') OR has_role('Katalog') OR has_role('Katalog Preise') OR has_role('Vertrieb') OR has_role('Vertriebsleitung') OR has_role('Marketing') OR has_role('Service') OR has_role('Geschäftsführung') OR has_role('Order') OR has_role('Lager') OR has_role('Technik') OR has_role('Tourenplanung') OR has_role('Reparaturannahme') OR has_role('Österreich') OR has_role('QM') OR can_access_finance())));

DROP POLICY IF EXISTS da_select_auth ON public.delivery_approvals;
CREATE POLICY da_select_auth ON public.delivery_approvals FOR SELECT TO authenticated
  USING ((SELECT public.is_internal_staff()));

DROP POLICY IF EXISTS "admin can read all user profiles" ON public.user_profiles;
CREATE POLICY "admin can read all user profiles" ON public.user_profiles FOR SELECT TO authenticated
  USING ((SELECT public.is_admin()));

DROP POLICY IF EXISTS ws_nav_select ON public.workspace_nav_items;
CREATE POLICY ws_nav_select ON public.workspace_nav_items FOR SELECT TO authenticated
  USING ((SELECT public.is_internal_staff()));