
-- 1) user_roles: prevent privilege escalation to Super Admin
DROP POLICY IF EXISTS "admin can insert user roles" ON public.user_roles;
DROP POLICY IF EXISTS "admin can update user roles" ON public.user_roles;

CREATE POLICY "admin can insert non-super-admin roles" ON public.user_roles
FOR INSERT TO authenticated
WITH CHECK (
  public.has_role('Super Admin')
  OR (
    public.is_admin()
    AND role_id NOT IN (SELECT id FROM public.roles WHERE name = 'Super Admin')
  )
);

CREATE POLICY "admin can update non-super-admin roles" ON public.user_roles
FOR UPDATE TO authenticated
USING (
  public.has_role('Super Admin')
  OR (
    public.is_admin()
    AND role_id NOT IN (SELECT id FROM public.roles WHERE name = 'Super Admin')
  )
)
WITH CHECK (
  public.has_role('Super Admin')
  OR (
    public.is_admin()
    AND role_id NOT IN (SELECT id FROM public.roles WHERE name = 'Super Admin')
  )
);

-- 2) customers: column-level restriction for bank PII
REVOKE SELECT (iban, bic, bank_name) ON public.customers FROM authenticated;
REVOKE SELECT (iban, bic, bank_name) ON public.customers FROM anon;
GRANT SELECT (iban, bic, bank_name) ON public.customers TO service_role;

-- Guarded accessor for legitimate use (Finance / Admin / Super Admin)
CREATE OR REPLACE FUNCTION public.get_customer_bank_details(_customer_id uuid)
RETURNS TABLE(iban text, bic text, bank_name text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role('Super Admin') OR public.has_role('Admin') OR public.has_role('Finance')) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  RETURN QUERY
    SELECT c.iban, c.bic, c.bank_name
    FROM public.customers c
    WHERE c.id = _customer_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_customer_bank_details(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_customer_bank_details(uuid) TO authenticated;

-- 3) roles: internal read restricted to admins
DROP POLICY IF EXISTS "internal staff can read roles" ON public.roles;
CREATE POLICY "admins can read roles" ON public.roles
FOR SELECT TO authenticated
USING (public.is_admin());

-- 4) departments: internal read restricted to admins
DROP POLICY IF EXISTS "internal staff can read departments" ON public.departments;
CREATE POLICY "admins can read departments" ON public.departments
FOR SELECT TO authenticated
USING (public.is_admin());

-- 5) tenants: readable to admins or explicitly granted users
DROP POLICY IF EXISTS "tenants readable by internal staff" ON public.tenants;
CREATE POLICY "tenants readable by admins or granted users" ON public.tenants
FOR SELECT TO authenticated
USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.user_tenant_access uta
    WHERE uta.user_id = auth.uid()
      AND uta.tenant_id = tenants.id
  )
);

-- 6) sms_templates: restrict read to admins + roles that actually send SMS
DROP POLICY IF EXISTS "sms_templates read for internal staff" ON public.sms_templates;
CREATE POLICY "sms_templates read for messaging roles" ON public.sms_templates
FOR SELECT TO authenticated
USING (
  public.is_admin()
  OR public.has_role('Kundenservice')
  OR public.has_role('Vertrieb')
  OR public.has_role('SACHBEARBEITUNG')
);
