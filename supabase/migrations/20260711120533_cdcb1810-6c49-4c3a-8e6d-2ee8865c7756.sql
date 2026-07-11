
-- Helper: management role for ESC master data (departments/employees/resources)
CREATE OR REPLACE FUNCTION public.can_manage_esc_master()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin()
      OR public.has_role('Geschäftsführung')
      OR public.has_role('Tourenplanung')
      OR public.has_role('Serviceleitung');
$$;
GRANT EXECUTE ON FUNCTION public.can_manage_esc_master() TO authenticated, service_role;

-- Helper: operational ESC write access (appointments, signatures, message log)
-- Any internal staff except explicit read-only roles.
CREATE OR REPLACE FUNCTION public.can_write_esc_operational()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_internal_user()
     AND NOT public.has_role('Read Only')
     AND NOT public.has_role('Read Only Audit');
$$;
GRANT EXECUTE ON FUNCTION public.can_write_esc_operational() TO authenticated, service_role;

-- =========================================================
-- Master data tables: restrict writes to management roles
-- =========================================================
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
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
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || ' internal insert', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || ' internal update', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || ' internal delete', t);

    EXECUTE format($p$CREATE POLICY "%s manage insert" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.can_manage_esc_master())$p$, t, t);
    EXECUTE format($p$CREATE POLICY "%s manage update" ON public.%I FOR UPDATE TO authenticated USING (public.can_manage_esc_master()) WITH CHECK (public.can_manage_esc_master())$p$, t, t);
    EXECUTE format($p$CREATE POLICY "%s manage delete" ON public.%I FOR DELETE TO authenticated USING (public.can_manage_esc_master())$p$, t, t);
  END LOOP;
END $$;

-- =========================================================
-- Operational tables: appointments (writable by any non-read-only staff)
-- =========================================================
DROP POLICY IF EXISTS "esc_store_appointments internal insert" ON public.esc_store_appointments;
DROP POLICY IF EXISTS "esc_store_appointments internal update" ON public.esc_store_appointments;
DROP POLICY IF EXISTS "esc_store_appointments internal delete" ON public.esc_store_appointments;

CREATE POLICY "esc_store_appointments op insert"
  ON public.esc_store_appointments FOR INSERT TO authenticated
  WITH CHECK (public.can_write_esc_operational());
CREATE POLICY "esc_store_appointments op update"
  ON public.esc_store_appointments FOR UPDATE TO authenticated
  USING (public.can_write_esc_operational())
  WITH CHECK (public.can_write_esc_operational());
CREATE POLICY "esc_store_appointments op delete"
  ON public.esc_store_appointments FOR DELETE TO authenticated
  USING (public.can_write_esc_operational());

-- esc_signatures
DROP POLICY IF EXISTS "esc_signatures internal insert" ON public.esc_signatures;
CREATE POLICY "esc_signatures op insert"
  ON public.esc_signatures FOR INSERT TO authenticated
  WITH CHECK (public.can_write_esc_operational());

-- esc_message_log
DROP POLICY IF EXISTS "insert message log internal" ON public.esc_message_log;
CREATE POLICY "insert message log op"
  ON public.esc_message_log FOR INSERT TO authenticated
  WITH CHECK (public.can_write_esc_operational());

-- =========================================================
-- repair_quote_history: INSERT must require manage, not read
-- =========================================================
DROP POLICY IF EXISTS "repair_quote_history insert" ON public.repair_quote_history;
CREATE POLICY "repair_quote_history insert"
  ON public.repair_quote_history FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_repair() OR public.has_role('Finance'));
