
-- 1. goodwill_cases: approver must differ from creator
DROP POLICY IF EXISTS goodwill_update ON public.goodwill_cases;
CREATE POLICY goodwill_update ON public.goodwill_cases
FOR UPDATE TO authenticated
USING (can_manage_warranty())
WITH CHECK (
  can_manage_warranty()
  AND (
    approved_by IS NULL
    OR created_by IS NULL
    OR approved_by <> created_by
  )
);

-- 2. warranty_decisions: approver/decider must differ from creator
DROP POLICY IF EXISTS warranty_decisions_update ON public.warranty_decisions;
CREATE POLICY warranty_decisions_update ON public.warranty_decisions
FOR UPDATE TO authenticated
USING (can_manage_warranty())
WITH CHECK (
  can_manage_warranty()
  AND (
    approved_by IS NULL
    OR created_by IS NULL
    OR approved_by <> created_by
  )
  AND (
    decided_by IS NULL
    OR created_by IS NULL
    OR decided_by <> created_by
  )
);

-- 3. user_roles: non-Super-Admin admins cannot target themselves
DROP POLICY IF EXISTS "admin can insert non-super-admin roles" ON public.user_roles;
CREATE POLICY "admin can insert non-super-admin roles"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (
  has_role('Super Admin')
  OR (
    is_admin()
    AND user_id <> auth.uid()
    AND NOT (role_id IN (SELECT roles.id FROM roles WHERE roles.name = 'Super Admin'))
  )
);

DROP POLICY IF EXISTS "admin can update non-super-admin roles" ON public.user_roles;
CREATE POLICY "admin can update non-super-admin roles"
ON public.user_roles FOR UPDATE TO authenticated
USING (
  has_role('Super Admin')
  OR (
    is_admin()
    AND user_id <> auth.uid()
    AND NOT (role_id IN (SELECT roles.id FROM roles WHERE roles.name = 'Super Admin'))
  )
)
WITH CHECK (
  has_role('Super Admin')
  OR (
    is_admin()
    AND user_id <> auth.uid()
    AND NOT (role_id IN (SELECT roles.id FROM roles WHERE roles.name = 'Super Admin'))
  )
);
