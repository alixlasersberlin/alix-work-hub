DO $m$
DECLARE r record;
  keep text[] := array['delivery_rating_token_valid','order_tenant_scope_ok','ph_catalog_public','tenant_scope_id_ok','tenant_scope_restricted','user_tenant_codes','tenant_scope_ok','tenant_scope_ok_id','esc_public_appointment_kinds','esc_public_departments','is_portal_customer','source_to_tenant_code','has_role','is_admin','current_portal_customer_id','current_supplier_id','is_supplier','has_tenant_access','user_accounting_regions'];
BEGIN
  FOR r IN SELECT p.oid::regprocedure fn FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.prosecdef AND has_function_privilege('anon', p.oid, 'EXECUTE')
      AND p.oid NOT IN (SELECT objid FROM pg_depend WHERE deptype='e')
      AND NOT (p.proname = ANY(keep))
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', r.fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', r.fn);
  END LOOP;
END $m$;