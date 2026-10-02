CREATE OR REPLACE FUNCTION public.is_internal_staff()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT auth.uid() IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.customer_portal_users WHERE user_id = auth.uid())
     AND NOT public.has_role('Lieferant')
     AND NOT public.has_role('Lieferant Jerry')
$$;
CREATE OR REPLACE FUNCTION public.is_internal_or_supplier()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT auth.uid() IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.customer_portal_users WHERE user_id = auth.uid())
$$;
REVOKE EXECUTE ON FUNCTION public.is_internal_staff() FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.is_internal_or_supplier() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_internal_staff() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_internal_or_supplier() TO authenticated, service_role;

DO $$
DECLARE r record; e text; q text; w text;
BEGIN
  FOR r IN
    SELECT c.relname tbl, pol.polname pn, pol.polcmd cmd,
           pg_get_expr(pol.polqual,pol.polrelid) qq, pg_get_expr(pol.polwithcheck,pol.polrelid) ww
    FROM pg_policy pol JOIN pg_class c ON c.oid=pol.polrelid
    WHERE c.relnamespace='public'::regnamespace
      AND (pg_get_expr(pol.polqual,pol.polrelid)='true' OR pg_get_expr(pol.polwithcheck,pol.polrelid)='true')
      AND NOT (pol.polroles @> ARRAY['service_role'::regrole::oid])
      AND c.relname NOT IN ('system_maintenance','mobile_app_config','app_releases','workspaces','workspace_nav_items')
  LOOP
    e := CASE WHEN r.tbl LIKE 'plm\_%' THEN 'public.is_internal_or_supplier()' ELSE 'public.is_internal_staff()' END;
    q := ''; w := '';
    IF r.qq = 'true' THEN q := format(' USING (%s)', e); END IF;
    IF r.ww = 'true' THEN w := format(' WITH CHECK (%s)', e); END IF;
    EXECUTE format('ALTER POLICY %I ON public.%I%s%s', r.pn, r.tbl, q, w);
  END LOOP;
END $$;