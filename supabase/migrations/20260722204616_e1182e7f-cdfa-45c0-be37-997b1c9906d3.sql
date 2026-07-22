
DO $$
DECLARE
  r record;
  keep_anon text[] := ARRAY[
    'esc_public_appointment_kinds',
    'esc_public_departments',
    'esc_public_bookings_rate_limit',
    'is_portal_customer',
    'alix_id_bootstrap_from_portal_users',
    'alixsmart_emit'
  ];
BEGIN
  FOR r IN
    SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND p.prosecdef
      AND NOT (p.proname = ANY(keep_anon))
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC, anon', r.proname, r.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated, service_role', r.proname, r.args);
  END LOOP;
END$$;
