ALTER POLICY sales_leads_admin_read_gate ON public.sales_leads USING ((SELECT lead_private.ml_super_admin()));
ALTER POLICY ml_direct_lead_insert_gate ON public.sales_leads WITH CHECK ((SELECT lead_private.ml_super_admin()));
ALTER POLICY ml_direct_lead_update_gate ON public.sales_leads USING ((SELECT lead_private.ml_super_admin())) WITH CHECK ((SELECT lead_private.ml_super_admin()));
CREATE POLICY sales_leads_super_admin_delete_gate ON public.sales_leads AS RESTRICTIVE FOR DELETE TO authenticated USING ((SELECT lead_private.ml_super_admin()));
ALTER POLICY sales_lead_history_admin_read_gate ON public.sales_lead_history USING ((SELECT lead_private.ml_super_admin()));
ALTER POLICY ml_history_insert_gate ON public.sales_lead_history WITH CHECK ((SELECT lead_private.ml_super_admin()));
ALTER POLICY sales_followups_admin_read_gate ON public.sales_followups USING ((SELECT lead_private.ml_super_admin()));
ALTER POLICY ml_followup_insert_gate ON public.sales_followups WITH CHECK ((SELECT lead_private.ml_super_admin()));
ALTER POLICY ml_followup_update_gate ON public.sales_followups USING ((SELECT lead_private.ml_super_admin())) WITH CHECK ((SELECT lead_private.ml_super_admin()));
CREATE POLICY sales_followups_super_admin_delete_gate ON public.sales_followups AS RESTRICTIVE FOR DELETE TO authenticated USING ((SELECT lead_private.ml_super_admin()));

DO $$
DECLARE u record; actual boolean; checked integer := 0; saved_claims text := current_setting('request.jwt.claims',true); saved_sub text := current_setting('request.jwt.claim.sub',true);
BEGIN
  FOR u IN SELECT p.id, (p.is_active AND p.account_status='active' AND p.invitation_status='accepted' AND NOT p.password_reset_required AND EXISTS(SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id=ur.role_id WHERE ur.user_id=p.id AND r.name='Super Admin')) AS expected FROM public.user_profiles p LOOP
    PERFORM set_config('request.jwt.claim.sub',u.id::text,true);
    PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',u.id,'role','authenticated')::text,true);
    SELECT lead_private.ml_super_admin() INTO actual;
    IF actual IS DISTINCT FROM coalesce(u.expected,false) THEN RAISE EXCEPTION 'Inquiry exact-role gate regression'; END IF;
    checked := checked + 1;
  END LOOP;
  IF checked = 0 THEN RAISE EXCEPTION 'No existing users available for inquiry gate validation'; END IF;
  PERFORM set_config('request.jwt.claim.sub','',true);
  PERFORM set_config('request.jwt.claims','{}',true);
  IF lead_private.ml_super_admin() THEN RAISE EXCEPTION 'Signed-out inquiry access must be denied'; END IF;
  PERFORM set_config('request.jwt.claim.sub',coalesce(saved_sub,''),true);
  PERFORM set_config('request.jwt.claims',coalesce(saved_claims,''),true);
END $$;