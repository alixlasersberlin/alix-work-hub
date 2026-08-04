DROP POLICY IF EXISTS "only super admin can delete recurring profiles" ON public.zoho_recurring_profiles;
CREATE POLICY "admins can delete recurring profiles"
ON public.zoho_recurring_profiles FOR DELETE
TO authenticated
USING (has_role('Super Admin') OR has_role('Admin'));