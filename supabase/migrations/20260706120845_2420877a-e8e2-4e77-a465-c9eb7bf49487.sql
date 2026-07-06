
DROP POLICY IF EXISTS "admins can insert zoho items" ON public.zoho_items;
DROP POLICY IF EXISTS "admins can update zoho items" ON public.zoho_items;

CREATE POLICY "admins and order can insert zoho items"
ON public.zoho_items FOR INSERT
WITH CHECK (is_admin() OR has_role('Order'));

CREATE POLICY "admins and order can update zoho items"
ON public.zoho_items FOR UPDATE
USING (is_admin() OR has_role('Order'))
WITH CHECK (is_admin() OR has_role('Order'));
