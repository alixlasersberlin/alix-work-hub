-- Exact active-role checks only; no product, mode, proof or external writes.
DO $$ DECLARE admin_id uuid; super_id uuid; BEGIN
 SELECT p.id INTO admin_id FROM public.user_profiles p
 WHERE p.account_status='active' AND p.invitation_status='accepted' AND p.password_reset_required=false
 AND EXISTS(SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id=ur.role_id WHERE ur.user_id=p.id AND r.name='Admin')
 AND NOT EXISTS(SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id=ur.role_id WHERE ur.user_id=p.id AND r.name='Super Admin') LIMIT 1;
 SELECT p.id INTO super_id FROM public.user_profiles p JOIN public.user_roles ur ON ur.user_id=p.id JOIN public.roles r ON r.id=ur.role_id
 WHERE p.account_status='active' AND p.invitation_status='accepted' AND p.password_reset_required=false AND r.name='Super Admin' LIMIT 1;
 IF admin_id IS NULL OR super_id IS NULL THEN RAISE EXCEPTION 'Exact-role fixtures unavailable'; END IF;
 BEGIN
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',admin_id,'role','authenticated')::text,true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  IF public.ph2_release_admin() IS NOT FALSE THEN RAISE EXCEPTION 'Inherited Admin passed exact Super Admin check'; END IF;
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',super_id,'role','authenticated')::text,true);
  IF public.ph2_release_admin() IS NOT TRUE THEN RAISE EXCEPTION 'Active exact Super Admin was denied'; END IF;
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',gen_random_uuid(),'role','authenticated')::text,true);
  IF public.ph2_release_admin() IS NOT FALSE THEN RAISE EXCEPTION 'Unknown account passed exact Super Admin check'; END IF;
  EXECUTE 'RESET ROLE';
  RAISE EXCEPTION 'exact_admin_rollback';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'exact_admin_rollback' THEN RAISE; END IF; END;
 RAISE NOTICE '3 exact active-role checks passed without writes';
END $$;