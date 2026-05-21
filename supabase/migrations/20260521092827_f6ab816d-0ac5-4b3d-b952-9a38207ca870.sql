DROP POLICY IF EXISTS "admins delete bank requests" ON public.bank_financing_requests;
CREATE POLICY "finance and admins delete bank requests"
  ON public.bank_financing_requests
  FOR DELETE
  TO authenticated
  USING (is_admin() OR can_access_finance());