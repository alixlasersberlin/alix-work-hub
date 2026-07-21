CREATE POLICY "cpcs_admin_read" ON public.customer_portal_contract_signatures
FOR SELECT TO authenticated
USING (public.has_role('Super Admin') OR public.has_role('Admin'));