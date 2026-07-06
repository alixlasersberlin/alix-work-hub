
-- roles
DROP POLICY IF EXISTS "authenticated can read roles" ON public.roles;
CREATE POLICY "internal staff can read roles" ON public.roles
  FOR SELECT TO authenticated
  USING (NOT public.is_portal_customer());

-- departments
DROP POLICY IF EXISTS "authenticated can read departments" ON public.departments;
CREATE POLICY "internal staff can read departments" ON public.departments
  FOR SELECT TO authenticated
  USING (NOT public.is_portal_customer());

-- tenants
DROP POLICY IF EXISTS "tenants readable by auth" ON public.tenants;
CREATE POLICY "tenants readable by internal staff" ON public.tenants
  FOR SELECT TO authenticated
  USING (NOT public.is_portal_customer());

-- sms_templates
DROP POLICY IF EXISTS "sms_templates read for authenticated" ON public.sms_templates;
CREATE POLICY "sms_templates read for internal staff" ON public.sms_templates
  FOR SELECT TO authenticated
  USING (NOT public.is_portal_customer());
