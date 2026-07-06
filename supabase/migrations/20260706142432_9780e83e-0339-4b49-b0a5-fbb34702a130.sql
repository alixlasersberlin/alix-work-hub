DROP POLICY IF EXISTS fat_insert ON public.finance_audit_trail;
CREATE POLICY fat_insert ON public.finance_audit_trail
  FOR INSERT TO authenticated
  WITH CHECK (public.can_access_finance_module() AND user_id = auth.uid());