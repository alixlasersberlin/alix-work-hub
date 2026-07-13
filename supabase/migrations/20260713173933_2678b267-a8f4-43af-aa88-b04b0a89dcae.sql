
DROP POLICY IF EXISTS approv_read_auth ON public.catalog_change_approvals;
CREATE POLICY approv_read_auth ON public.catalog_change_approvals FOR SELECT TO authenticated
USING (has_role('Super Admin'::text) OR has_role('Admin'::text) OR has_role('Katalog'::text) OR has_role('Katalog Preise'::text));

DROP POLICY IF EXISTS pending_read_auth ON public.catalog_pending_changes;
CREATE POLICY pending_read_auth ON public.catalog_pending_changes FOR SELECT TO authenticated
USING (has_role('Super Admin'::text) OR has_role('Admin'::text) OR has_role('Katalog'::text) OR has_role('Katalog Preise'::text));

DROP POLICY IF EXISTS pg_read_auth ON public.catalog_price_groups;
CREATE POLICY pg_read_auth ON public.catalog_price_groups FOR SELECT TO authenticated
USING (has_role('Super Admin'::text) OR has_role('Admin'::text) OR has_role('Katalog'::text) OR has_role('Katalog Preise'::text) OR has_role('Order'::text) OR has_role('Finance'::text));
