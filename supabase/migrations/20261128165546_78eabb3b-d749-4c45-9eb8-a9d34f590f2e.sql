CREATE OR REPLACE FUNCTION public.expire_temporary_role_grants() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v_count integer;
BEGIN
 IF NOT ((auth.uid() IS NULL AND coalesce(auth.role(),'') NOT IN ('anon','authenticated') AND session_user IN ('postgres','supabase_admin')) OR auth.role()='service_role' OR (public.has_role('Super Admin') AND cardinality(public.user_tenant_codes())>0)) THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501'; END IF;
 WITH updated AS (UPDATE public.role_temporary_grants SET status='expired',auto_revoked_at=now() WHERE status='active' AND valid_until<=now() RETURNING id) SELECT count(*) INTO v_count FROM updated;
 RETURN v_count;
END $$;
CREATE POLICY security_sms_review_escalation_parent ON public.conversation_escalations AS RESTRICTIVE FOR ALL TO authenticated
 USING ((SELECT public.is_internal_staff()) AND conversation_id IN (SELECT c.id FROM public.ac_conversations c))
 WITH CHECK ((SELECT public.is_internal_staff()) AND conversation_id IN (SELECT c.id FROM public.ac_conversations c));
CREATE POLICY security_sms_review_escalation_delete ON public.conversation_escalations AS RESTRICTIVE FOR DELETE TO authenticated USING ((SELECT public.has_role('Super Admin')));
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_policy WHERE polrelid='public.conversation_escalations'::regclass AND polname='security_sms_review_escalation_parent' AND NOT polpermissive) THEN RAISE EXCEPTION 'Escalation parent guard absent'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_policy WHERE polrelid='public.conversation_escalations'::regclass AND polname='security_sms_review_escalation_delete' AND NOT polpermissive AND polcmd='d') THEN RAISE EXCEPTION 'Escalation deletion guard absent'; END IF;
END $$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000000"}',true);
DO $$ BEGIN
 BEGIN PERFORM public.expire_temporary_role_grants(); RAISE EXCEPTION 'Unassigned role expiry caller accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 IF EXISTS(SELECT 1 FROM public.conversation_escalations) THEN RAISE EXCEPTION 'Unassigned escalation access'; END IF;
END $$;
RESET ROLE;