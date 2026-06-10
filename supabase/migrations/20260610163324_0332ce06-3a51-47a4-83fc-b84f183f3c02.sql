
DROP POLICY IF EXISTS "everyone can read app settings" ON public.app_settings;
CREATE POLICY "internal staff can read app settings"
  ON public.app_settings
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR public.can_access_finance()
    OR public.can_manage_planning()
  );

DROP POLICY IF EXISTS "fsal_insert" ON public.finance_stakeholder_access_logs;
CREATE POLICY "fsal_insert"
  ON public.finance_stakeholder_access_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role('Super Admin') OR public.has_role('Geschäftsführung')
  );
