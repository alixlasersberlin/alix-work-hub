
-- 1. Drop unsafe anon SELECT policies
DROP POLICY IF EXISTS esc_dept_public_read_safe ON public.esc_departments;
DROP POLICY IF EXISTS esc_evtype_public_read_safe ON public.esc_event_types;

-- 2. Create safe public views with only booking-relevant columns
CREATE OR REPLACE VIEW public.esc_departments_public
WITH (security_invoker = true) AS
SELECT id, name, slug, description, color, icon,
       default_duration_minutes, default_location,
       is_active, is_public_bookable
FROM public.esc_departments
WHERE is_active AND is_public_bookable;

CREATE OR REPLACE VIEW public.esc_event_types_public
WITH (security_invoker = true) AS
SELECT id, department_id, name, slug, description, color, icon,
       default_duration_minutes, requires_confirmation_default,
       is_active, is_public_bookable
FROM public.esc_event_types
WHERE is_active AND is_public_bookable;

-- 3. Re-add narrowly scoped anon SELECT policies so the views can read underlying rows
CREATE POLICY esc_dept_public_read_min ON public.esc_departments
  FOR SELECT TO anon
  USING (is_active AND is_public_bookable);

CREATE POLICY esc_evtype_public_read_min ON public.esc_event_types
  FOR SELECT TO anon
  USING (is_active AND is_public_bookable);

-- Note: anon still technically could query the base table, but frontends should use the views.
-- To truly hide internal columns, revoke column-level privileges on sensitive fields:
REVOKE SELECT ON public.esc_departments FROM anon;
REVOKE SELECT ON public.esc_event_types FROM anon;
GRANT SELECT (id, name, slug, description, color, icon,
              default_duration_minutes, default_location,
              is_active, is_public_bookable)
  ON public.esc_departments TO anon;
GRANT SELECT (id, department_id, name, slug, description, color, icon,
              default_duration_minutes, requires_confirmation_default,
              is_active, is_public_bookable)
  ON public.esc_event_types TO anon;

GRANT SELECT ON public.esc_departments_public TO anon, authenticated;
GRANT SELECT ON public.esc_event_types_public TO anon, authenticated;

-- 4. Tighten anon INSERT policy on esc_public_bookings with content validation
DROP POLICY IF EXISTS esc_pub_anon_insert ON public.esc_public_bookings;

CREATE POLICY esc_pub_anon_insert ON public.esc_public_bookings
  FOR INSERT TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.esc_departments d
      WHERE d.id = esc_public_bookings.department_id
        AND d.is_active AND d.is_public_bookable
    )
    AND customer_name IS NOT NULL
    AND length(btrim(customer_name)) BETWEEN 2 AND 120
    AND customer_email IS NOT NULL
    AND length(customer_email) BETWEEN 5 AND 254
    AND customer_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
    AND (customer_phone IS NULL OR length(customer_phone) <= 40)
    AND (company_name IS NULL OR length(company_name) <= 200)
    AND (message IS NULL OR length(message) <= 2000)
    AND (status IS NULL OR status = 'pending')
    AND created_event_id IS NULL
  );
