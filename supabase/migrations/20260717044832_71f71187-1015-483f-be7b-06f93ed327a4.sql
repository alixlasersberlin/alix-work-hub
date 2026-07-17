
ALTER FUNCTION public.sig_touch_updated_at() SET search_path = public;
ALTER FUNCTION public.sig_can_send() SET search_path = public;
ALTER FUNCTION public.sig_is_admin() SET search_path = public;
ALTER FUNCTION public.sig_audit_block_mutation() SET search_path = public;

DROP POLICY IF EXISTS "sig_audit_insert" ON public.sig_audit_log;
CREATE POLICY "sig_audit_insert" ON public.sig_audit_log FOR INSERT TO authenticated
  WITH CHECK (public.sig_is_admin() OR public.sig_can_send());
