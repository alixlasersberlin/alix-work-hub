
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', r.sig);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', r.sig);
  END LOOP;
END$$;

-- Re-grant to authenticated for functions that RLS policies or client RPCs depend on
GRANT EXECUTE ON FUNCTION public.has_role(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_supplier() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_portal_customer() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_supplier_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_portal_customer_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.requires_reauth() TO authenticated;
GRANT EXECUTE ON FUNCTION public.session_requires_reauth() TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_password_setup() TO authenticated;

GRANT EXECUTE ON FUNCTION public.can_access_ai_service() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_run_ai_service() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_finance() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_financing() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_import_logs() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_mail() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_mail_audit() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_mail_domains() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_mail_templates() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_mail_campaigns() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_maintenance() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_maintenance() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_orders() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_orders() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_planning() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_planning() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_qm() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_repair() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_repair() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_tickets() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_tickets() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_send_whatsapp() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_whatsapp_automation() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_upload_factory_invoice() TO authenticated;

GRANT EXECUTE ON FUNCTION public.set_factory_invoice_pdf(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_factory_invoice_pdf(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_factory_invoice_payment_ok(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_audit_event(text, text, text, jsonb, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_table_columns(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_mailboxes() TO authenticated;
