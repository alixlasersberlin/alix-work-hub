CREATE OR REPLACE FUNCTION public.security_finance_approval_actor_guard() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE uid uuid := auth.uid(); allowed boolean;
BEGIN
 IF auth.role()='service_role' OR (uid IS NULL AND COALESCE(current_setting('role',true),'none') NOT IN ('authenticated','anon')) THEN RETURN NEW; END IF;
 IF uid IS NULL THEN RAISE EXCEPTION 'Unauthorized' USING ERRCODE='42501'; END IF;
 IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id OR NEW.entity_type IS DISTINCT FROM OLD.entity_type OR NEW.entity_id IS DISTINCT FROM OLD.entity_id OR NEW.requested_by IS DISTINCT FROM OLD.requested_by OR NEW.requires_dual_approval IS DISTINCT FROM OLD.requires_dual_approval THEN RAISE EXCEPTION 'Freigabeidentität ist unveränderbar' USING ERRCODE='42501'; END IF;
 IF NEW.status IS NOT DISTINCT FROM OLD.status AND NEW.approved_by IS NOT DISTINCT FROM OLD.approved_by AND NEW.second_approver_id IS NOT DISTINCT FROM OLD.second_approver_id AND NEW.approved_at IS NOT DISTINCT FROM OLD.approved_at AND NEW.second_approved_at IS NOT DISTINCT FROM OLD.second_approved_at THEN RETURN NEW; END IF;
 allowed := (public.can_access_finance() OR public.has_role('Geschäftsführung')) AND EXISTS(SELECT 1 FROM public.user_profiles p WHERE p.id=uid AND p.is_active IS TRUE AND p.account_status='active' AND p.invitation_status='accepted' AND p.password_reset_required IS FALSE) AND (public.user_has_tenant(OLD.tenant_id) OR (OLD.tenant_id IS NULL AND NOT public.tenant_scope_restricted()));
 IF NOT allowed OR OLD.status <> 'pending' THEN RAISE EXCEPTION 'Freigabe nicht zulässig' USING ERRCODE='42501'; END IF;
 IF NEW.status='cancelled' THEN
  IF NEW.approved_by IS DISTINCT FROM OLD.approved_by OR NEW.second_approver_id IS DISTINCT FROM OLD.second_approver_id THEN RAISE EXCEPTION 'Genehmiger dürfen nicht ersetzt werden' USING ERRCODE='42501'; END IF;
  RETURN NEW;
 END IF;
 IF OLD.requested_by=uid THEN RAISE EXCEPTION 'Keine Selbstfreigabe' USING ERRCODE='42501'; END IF;
 IF NEW.status='rejected' OR OLD.approved_by IS NULL THEN
  IF NEW.approved_by IS DISTINCT FROM uid OR NEW.second_approver_id IS NOT NULL THEN RAISE EXCEPTION 'Genehmiger muss angemeldeter Mitarbeiter sein' USING ERRCODE='42501'; END IF;
  IF OLD.requires_dual_approval AND NEW.status='approved' THEN RAISE EXCEPTION 'Zweiter Genehmiger erforderlich' USING ERRCODE='42501'; END IF;
  NEW.approved_at:=now();
 ELSE
  IF NEW.approved_by IS DISTINCT FROM OLD.approved_by OR NOT OLD.requires_dual_approval OR OLD.approved_by=uid OR NEW.second_approver_id IS DISTINCT FROM uid OR NEW.status<>'approved' THEN RAISE EXCEPTION 'Zwei unterschiedliche Genehmiger erforderlich' USING ERRCODE='42501'; END IF;
  NEW.approved_at:=OLD.approved_at; NEW.second_approved_at:=now();
 END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.security_finance_approval_actor_guard() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.security_finance_approval_actor_guard() TO service_role;
CREATE TRIGGER security_finance_approval_actor_guard BEFORE UPDATE ON public.finance_approvals FOR EACH ROW EXECUTE FUNCTION public.security_finance_approval_actor_guard();
CREATE POLICY security_analysis_document_bound ON public.sig_ai_analyses AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (created_by=(SELECT auth.uid()) AND EXISTS(SELECT 1 FROM public.sig_documents d WHERE d.id=document_id) AND EXISTS(SELECT 1 FROM public.user_profiles p WHERE p.id=(SELECT auth.uid()) AND p.is_active IS TRUE AND p.account_status='active' AND p.invitation_status='accepted' AND p.password_reset_required IS FALSE));