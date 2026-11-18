CREATE FUNCTION lead_private.sanae_offer_reader()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public
AS $function$ SELECT EXISTS (
  SELECT 1
  FROM public.user_profiles p
  JOIN public.user_roles ur ON ur.user_id=p.id
  JOIN public.roles r ON r.id=ur.role_id
  WHERE p.id=auth.uid()
    AND p.id='7212fdcc-3bc3-4092-85cc-f96c6821c21e'::uuid
    AND p.account_status='active'
    AND p.is_active IS TRUE
    AND p.invitation_status='accepted'
    AND p.password_reset_required IS FALSE
    AND r.name='Angebotsersteller'
); $function$;
REVOKE ALL ON FUNCTION lead_private.sanae_offer_reader() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION lead_private.sanae_offer_reader() TO authenticated, service_role;
CREATE POLICY offers_sanae_read_all ON public.offers
FOR SELECT TO authenticated
USING ((SELECT lead_private.sanae_offer_reader()));

DO $test$
DECLARE expected_count bigint; actual_count bigint; foreign_count bigint; role_count bigint;
BEGIN
  PERFORM set_config('request.jwt.claim.sub','7212fdcc-3bc3-4092-85cc-f96c6821c21e',true);
  PERFORM set_config('request.jwt.claims','{"sub":"7212fdcc-3bc3-4092-85cc-f96c6821c21e","role":"authenticated"}',true);
  SELECT count(*) INTO role_count FROM public.user_roles ur JOIN public.roles r ON r.id=ur.role_id WHERE ur.user_id=auth.uid() AND r.name='Angebotsersteller';
  IF role_count <> 1 OR (SELECT count(*) FROM public.user_roles WHERE user_id=auth.uid()) <> 1 THEN
    RAISE EXCEPTION 'Sanae must retain only Angebotsersteller';
  END IF;
  SELECT count(*) INTO expected_count FROM public.offers WHERE NOT public.tenant_scope_restricted() OR public.tenant_scope_id_ok(tenant_id);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO actual_count FROM public.offers;
  SELECT count(*) INTO foreign_count FROM public.offers WHERE created_by IS DISTINCT FROM auth.uid();
  IF actual_count <> expected_count OR foreign_count = 0 THEN
    RAISE EXCEPTION 'Offer read test failed: expected %, actual %, foreign %',expected_count,actual_count,foreign_count;
  END IF;
  IF public.is_internal_staff() THEN RAISE EXCEPTION 'General staff access must remain disabled'; END IF;
  EXECUTE 'RESET ROLE';
  RAISE NOTICE 'Verified Sanae: % visible offers including % offers by others; general staff access disabled',actual_count,foreign_count;
  PERFORM set_config('request.jwt.claim.sub','',true);
  PERFORM set_config('request.jwt.claims','{}',true);
END
$test$;