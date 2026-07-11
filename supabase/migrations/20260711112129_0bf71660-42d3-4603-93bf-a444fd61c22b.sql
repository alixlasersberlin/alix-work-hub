
-- Helper: true if the current auth user is an internal staff account (has a user_profiles row)
CREATE OR REPLACE FUNCTION public.is_internal_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = auth.uid());
$$;

GRANT EXECUTE ON FUNCTION public.is_internal_user() TO authenticated, anon, service_role;

-- =========================================================
-- esc_store_* tables: replace permissive `true` policies
-- =========================================================
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'esc_store_appointments',
    'esc_store_departments',
    'esc_store_employees',
    'esc_store_rm_absences',
    'esc_store_rm_demo_devices',
    'esc_store_rm_employees',
    'esc_store_rm_locations',
    'esc_store_rm_maintenance',
    'esc_store_rm_qualifications',
    'esc_store_rm_rooms',
    'esc_store_rm_vehicles'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || ' auth read',   t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || ' auth insert', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || ' auth update', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || ' auth delete', t);

    EXECUTE format($p$CREATE POLICY "%s internal read"   ON public.%I FOR SELECT TO authenticated USING (public.is_internal_user())$p$, t, t);
    EXECUTE format($p$CREATE POLICY "%s internal insert" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_internal_user())$p$, t, t);
    EXECUTE format($p$CREATE POLICY "%s internal update" ON public.%I FOR UPDATE TO authenticated USING (public.is_internal_user()) WITH CHECK (public.is_internal_user())$p$, t, t);
    EXECUTE format($p$CREATE POLICY "%s internal delete" ON public.%I FOR DELETE TO authenticated USING (public.is_internal_user())$p$, t, t);
  END LOOP;
END $$;

-- =========================================================
-- esc_signatures: tighten auth read + auth insert
-- =========================================================
DROP POLICY IF EXISTS "esc_signatures auth read"   ON public.esc_signatures;
DROP POLICY IF EXISTS "esc_signatures auth insert" ON public.esc_signatures;

CREATE POLICY "esc_signatures internal read"
  ON public.esc_signatures FOR SELECT
  TO authenticated
  USING (public.is_internal_user());

CREATE POLICY "esc_signatures internal insert"
  ON public.esc_signatures FOR INSERT
  TO authenticated
  WITH CHECK (public.is_internal_user());

-- =========================================================
-- esc_message_log: restrict INSERT to internal users
-- =========================================================
DROP POLICY IF EXISTS "insert message log auth" ON public.esc_message_log;

CREATE POLICY "insert message log internal"
  ON public.esc_message_log FOR INSERT
  TO authenticated
  WITH CHECK (public.is_internal_user());
