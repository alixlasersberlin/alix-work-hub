
-- Restrict offer_followup_settings SELECT to admins/operations role
DROP POLICY IF EXISTS settings_select ON public.offer_followup_settings;
CREATE POLICY settings_select ON public.offer_followup_settings
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- Tighten finance_audit_trail INSERT: require user_id = auth.uid() (or null for system/service)
DROP POLICY IF EXISTS fat_insert ON public.finance_audit_trail;
CREATE POLICY fat_insert ON public.finance_audit_trail
  FOR INSERT TO authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());
