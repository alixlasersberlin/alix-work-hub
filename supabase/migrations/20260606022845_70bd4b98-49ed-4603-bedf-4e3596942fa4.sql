
-- 1. mail_domains: restrict to Super Admin only
DROP POLICY IF EXISTS mail_domains_access ON public.mail_domains;
CREATE POLICY mail_domains_select ON public.mail_domains FOR SELECT TO authenticated USING (public.can_manage_mail_domains());
CREATE POLICY mail_domains_insert ON public.mail_domains FOR INSERT TO authenticated WITH CHECK (public.can_manage_mail_domains());
CREATE POLICY mail_domains_update ON public.mail_domains FOR UPDATE TO authenticated USING (public.can_manage_mail_domains()) WITH CHECK (public.can_manage_mail_domains());
CREATE POLICY mail_domains_delete ON public.mail_domains FOR DELETE TO authenticated USING (public.can_manage_mail_domains());

-- 2. mail_events: staff read; only service_role writes (no policy needed for service_role - it bypasses RLS)
DROP POLICY IF EXISTS mail_events_access ON public.mail_events;
CREATE POLICY mail_events_select ON public.mail_events FOR SELECT TO authenticated USING (public.can_access_mail() OR public.can_view_mail_audit());

-- 3. mail_messages: staff full access; portal customers only their own (kept existing select policy)
DROP POLICY IF EXISTS mail_messages_access ON public.mail_messages;
CREATE POLICY mail_messages_staff_select ON public.mail_messages FOR SELECT TO authenticated USING (public.can_access_mail());
CREATE POLICY mail_messages_staff_insert ON public.mail_messages FOR INSERT TO authenticated WITH CHECK (public.can_access_mail());
CREATE POLICY mail_messages_staff_update ON public.mail_messages FOR UPDATE TO authenticated USING (public.can_access_mail()) WITH CHECK (public.can_access_mail());
CREATE POLICY mail_messages_admin_delete ON public.mail_messages FOR DELETE TO authenticated USING (public.has_role('Super Admin'));

-- 4. mail_templates: read for staff, write for managers
DROP POLICY IF EXISTS mail_templates_access ON public.mail_templates;
CREATE POLICY mail_templates_select ON public.mail_templates FOR SELECT TO authenticated USING (public.can_access_mail());
CREATE POLICY mail_templates_insert ON public.mail_templates FOR INSERT TO authenticated WITH CHECK (public.can_manage_mail_templates());
CREATE POLICY mail_templates_update ON public.mail_templates FOR UPDATE TO authenticated USING (public.can_manage_mail_templates()) WITH CHECK (public.can_manage_mail_templates());
CREATE POLICY mail_templates_delete ON public.mail_templates FOR DELETE TO authenticated USING (public.has_role('Super Admin'));

-- 5. order_documents UPDATE: scope to authenticated
DROP POLICY IF EXISTS "authorized roles can update order documents" ON public.order_documents;
CREATE POLICY "authorized roles can update order documents" ON public.order_documents
  FOR UPDATE TO authenticated USING (public.can_manage_orders()) WITH CHECK (public.can_manage_orders());

-- 6. storage.objects order-invoices policies: scope to authenticated
DROP POLICY IF EXISTS "Order managers can read order invoices" ON storage.objects;
CREATE POLICY "Order managers can read order invoices" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'order-invoices' AND public.can_manage_orders());

DROP POLICY IF EXISTS "Order managers can update order invoices" ON storage.objects;
CREATE POLICY "Order managers can update order invoices" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'order-invoices' AND public.can_manage_orders())
  WITH CHECK (bucket_id = 'order-invoices' AND public.can_manage_orders());

DROP POLICY IF EXISTS "Order managers can delete order invoices" ON storage.objects;
CREATE POLICY "Order managers can delete order invoices" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'order-invoices' AND public.can_manage_orders());

DROP POLICY IF EXISTS "admins can read order invoices" ON storage.objects;
CREATE POLICY "admins can read order invoices" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'order-invoices' AND public.is_admin());

DROP POLICY IF EXISTS "admins can delete order invoices" ON storage.objects;
CREATE POLICY "admins can delete order invoices" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'order-invoices' AND public.is_admin());

-- 7. Fix mutable search_path on set_updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

-- 8. Revoke EXECUTE from anon on SECURITY DEFINER helper functions (not meant for anonymous use)
REVOKE EXECUTE ON FUNCTION public.has_role(text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.can_access_mail() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.can_manage_mail_domains() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.can_manage_mail_templates() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.can_manage_mail_campaigns() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.can_view_mail_audit() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.can_access_orders() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.can_manage_orders() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.can_manage_planning() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.can_access_planning() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.can_access_finance() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.can_access_financing() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.can_access_import_logs() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.can_access_repair() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.can_manage_repair() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.can_access_qm() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.can_upload_factory_invoice() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.can_send_whatsapp() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.can_manage_whatsapp_automation() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.current_supplier_id() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.current_portal_customer_id() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_portal_customer() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_supplier() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.requires_reauth() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.session_requires_reauth() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.user_mailboxes() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.complete_password_setup() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.set_factory_invoice_pdf(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.set_factory_invoice_payment_ok(uuid, boolean) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.clear_factory_invoice_pdf(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.log_audit_event(text, text, text, jsonb, text, text) FROM anon, public;

GRANT EXECUTE ON FUNCTION public.has_role(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_mail() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_mail_domains() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_mail_templates() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_mail_campaigns() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_mail_audit() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_orders() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_orders() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_planning() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_planning() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_finance() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_financing() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_import_logs() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_repair() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_repair() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_qm() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_upload_factory_invoice() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_send_whatsapp() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_whatsapp_automation() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_supplier_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_portal_customer_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_portal_customer() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_supplier() TO authenticated;
GRANT EXECUTE ON FUNCTION public.requires_reauth() TO authenticated;
GRANT EXECUTE ON FUNCTION public.session_requires_reauth() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_mailboxes() TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_password_setup() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_factory_invoice_pdf(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_factory_invoice_payment_ok(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_factory_invoice_pdf(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_audit_event(text, text, text, jsonb, text, text) TO authenticated;
