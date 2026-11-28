-- Read-only authenticated checks; no financial writes or external actions.
DO $test$
DECLARE admin_id uuid; claims text:=current_setting('request.jwt.claims',true); sub text:=current_setting('request.jwt.claim.sub',true);
BEGIN
 SELECT p.id INTO admin_id FROM public.user_profiles p JOIN public.user_roles ur ON ur.user_id=p.id JOIN public.roles r ON r.id=ur.role_id
 WHERE r.name='Admin' AND p.is_active IS TRUE AND p.account_status='active' AND p.invitation_status='accepted' AND p.password_reset_required IS FALSE
 AND NOT EXISTS(SELECT 1 FROM public.user_roles a JOIN public.roles b ON b.id=a.role_id WHERE a.user_id=p.id AND b.name='Super Admin') LIMIT 1;
 IF admin_id IS NULL THEN RAISE EXCEPTION 'Required active ordinary Admin fixture missing'; END IF;
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',admin_id,'role','authenticated')::text,true);
 PERFORM set_config('request.jwt.claim.sub',admin_id::text,true);
 EXECUTE 'SET LOCAL ROLE authenticated';
 IF NOT public.has_role('Admin') OR public.has_role('Super Admin') THEN RAISE EXCEPTION 'Ordinary Admin role inheritance regression'; END IF;
 IF NOT public.tenant_scope_ok('zoho_eu_1') OR NOT public.tenant_scope_ok('zoho_eu_2') THEN RAISE EXCEPTION 'Explicit multi-company access regression'; END IF;
 IF (SELECT count(*) FROM public.ac_contacts)=0 THEN RAISE EXCEPTION 'Authorized contact reads regression'; END IF;
 PERFORM set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000000","role":"authenticated"}',true);
 PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000000',true);
 IF public.has_role('Admin') OR public.has_role('Super Admin') OR public.tenant_scope_ok('zoho_eu_1') OR public.tenant_scope_id_ok(NULL) THEN RAISE EXCEPTION 'Unassigned identity authorization regression'; END IF;
 IF (SELECT count(*) FROM public.ac_contacts)<>0 THEN RAISE EXCEPTION 'Unassigned contact disclosure'; END IF;
 IF (SELECT count(*) FROM public.ac_conversations)<>0 THEN RAISE EXCEPTION 'Unassigned conversation disclosure'; END IF;
 IF (SELECT count(*) FROM public.ac_messages)<>0 THEN RAISE EXCEPTION 'Unassigned message disclosure'; END IF;
 IF (SELECT count(*) FROM public.alixdocs_documents)<>0 THEN RAISE EXCEPTION 'Unassigned document disclosure'; END IF;
 IF (SELECT count(*) FROM public.finance_transactions)<>0 THEN RAISE EXCEPTION 'Unassigned finance disclosure'; END IF;
 EXECUTE 'RESET ROLE';
 PERFORM set_config('request.jwt.claims',coalesce(claims,''),true);
 PERFORM set_config('request.jwt.claim.sub',coalesce(sub,''),true);
END $test$;