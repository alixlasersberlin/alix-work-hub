DO $mig$
DECLARE r record; re text := '^(tenant_scope_id_ok|tenant_scope_ok_id|tenant_scope_ok|customer_tenant_ok|collect_case_tenant_ok|esc_event_tenant_ok)\(([a-z_]+)\)$';
  new_q text; new_c text; sql text;
BEGIN
  FOR r IN SELECT schemaname, tablename, policyname, qual, with_check FROM pg_policies
           WHERE schemaname='public' AND (qual ~ re OR with_check ~ re) LOOP
    new_q := CASE WHEN r.qual ~ re THEN '((SELECT (NOT public.tenant_scope_restricted())) OR public.' || r.qual || ')' END;
    new_c := CASE WHEN r.with_check ~ re THEN '((SELECT (NOT public.tenant_scope_restricted())) OR public.' || r.with_check || ')' END;
    sql := format('ALTER POLICY %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
    IF new_q IS NOT NULL THEN sql := sql || ' USING ' || new_q; END IF;
    IF new_c IS NOT NULL THEN sql := sql || ' WITH CHECK ' || new_c; END IF;
    EXECUTE sql;
  END LOOP;
END $mig$;

DROP POLICY IF EXISTS portal_customer_select_own_offers ON public.offers;
CREATE POLICY portal_customer_select_own_offers ON public.offers FOR SELECT TO authenticated
  USING ((customer_visible = true) AND (customer_id = (SELECT public.current_portal_customer_id())));