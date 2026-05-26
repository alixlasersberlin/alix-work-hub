
-- Revoke EXECUTE from anon/public on all SECURITY DEFINER helper functions,
-- grant only to authenticated and service_role.

DO $$
DECLARE
  fn record;
  fn_signatures text[] := ARRAY[
    'public.clear_factory_invoice_pdf(uuid)',
    'public.set_factory_invoice_pdf(uuid, text)',
    'public.set_factory_invoice_payment_ok(uuid, boolean)',
    'public.can_access_financing()',
    'public.requires_reauth()',
    'public.current_supplier_id()',
    'public.can_access_import_logs()',
    'public.can_access_orders()',
    'public.can_access_planning()',
    'public.can_manage_orders()',
    'public.can_manage_planning()',
    'public.has_role(text)',
    'public.is_supplier()',
    'public.can_upload_factory_invoice()',
    'public.log_audit_event(text, text, text, jsonb, text, text)',
    'public.session_requires_reauth()',
    'public.can_access_finance()',
    'public.is_admin()'
  ];
  sig text;
BEGIN
  FOREACH sig IN ARRAY fn_signatures LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', sig);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', sig);
  END LOOP;
END$$;

-- Trigger functions: nobody needs direct EXECUTE; revoke from public/anon/authenticated.
REVOKE ALL ON FUNCTION public.assign_production_order_number() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_by() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.check_user_profile_self_update() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_order_status_change() FROM PUBLIC, anon, authenticated;
