-- Revoke public/anon EXECUTE on internal SECURITY DEFINER helpers; grant only to authenticated
DO $$
DECLARE
  fn record;
  sig text;
BEGIN
  FOR fn IN
    SELECT n.nspname, p.proname,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND p.proname IN (
        'has_role',
        'is_admin',
        'is_supplier',
        'current_supplier_id',
        'can_access_orders',
        'can_manage_orders',
        'can_access_import_logs',
        'can_access_planning',
        'can_manage_planning',
        'can_access_finance',
        'requires_reauth',
        'session_requires_reauth',
        'log_order_status_change',
        'check_user_profile_self_update',
        'log_audit_event'
      )
  LOOP
    sig := format('%I.%I(%s)', fn.nspname, fn.proname, fn.args);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', sig);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', sig);
  END LOOP;
END $$;