
-- =========================================================
-- 1) ESC public columns exposure: remove anon full-table access,
--    replace with narrow views that hide internal staff/template IDs.
-- =========================================================
DROP POLICY IF EXISTS "esc_dept_public_read" ON public.esc_departments;
DROP POLICY IF EXISTS "esc_evtype_public_read" ON public.esc_event_types;

REVOKE SELECT ON public.esc_departments FROM anon;
REVOKE SELECT ON public.esc_event_types FROM anon;

CREATE OR REPLACE VIEW public.esc_public_departments
WITH (security_invoker = true) AS
SELECT
  id, name, slug, description, color, icon,
  default_duration_minutes, default_location,
  is_public_bookable, is_active
FROM public.esc_departments
WHERE is_active AND is_public_bookable;

CREATE OR REPLACE VIEW public.esc_public_event_types
WITH (security_invoker = true) AS
SELECT
  id, department_id, name, slug, description, color, icon,
  default_duration_minutes, requires_confirmation_default,
  is_public_bookable, is_active
FROM public.esc_event_types
WHERE is_active AND is_public_bookable;

-- Views need underlying-table SELECT for the querying role.
-- Re-add narrow anon policies limited to publicly bookable rows so the views work,
-- but the anon grant on the base table stays revoked — anon can only read via the view.
-- Because views are security_invoker, we need to grant SELECT on the base tables to anon
-- restricted to the columns exposed by the view. Postgres does not support column-level
-- RLS, but we can grant column-level SELECT privileges.
GRANT SELECT (id, name, slug, description, color, icon,
              default_duration_minutes, default_location,
              is_public_bookable, is_active)
  ON public.esc_departments TO anon;

GRANT SELECT (id, department_id, name, slug, description, color, icon,
              default_duration_minutes, requires_confirmation_default,
              is_public_bookable, is_active)
  ON public.esc_event_types TO anon;

CREATE POLICY "esc_dept_public_read_safe" ON public.esc_departments
  FOR SELECT TO anon USING (is_active AND is_public_bookable);
CREATE POLICY "esc_evtype_public_read_safe" ON public.esc_event_types
  FOR SELECT TO anon USING (is_active AND is_public_bookable);

GRANT SELECT ON public.esc_public_departments TO anon, authenticated;
GRANT SELECT ON public.esc_public_event_types TO anon, authenticated;

-- =========================================================
-- 2) Tenant isolation: has_tenant_access() must not auto-allow
--    NULL tenant_id rows for regular users.
-- =========================================================
CREATE OR REPLACE FUNCTION public.has_tenant_access(_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role('Super Admin')
    OR (
      _tenant_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.user_tenant_access
        WHERE user_id = auth.uid() AND tenant_id = _tenant_id
      )
    );
$$;
