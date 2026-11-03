-- 1) Source → tenant mapping: read the mapping table without per-row RLS evaluation
CREATE OR REPLACE FUNCTION public.source_to_tenant_code(_source text)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT t.code FROM public.tenants t WHERE t.zoho_source_system = _source LIMIT 1),
    CASE _source
      WHEN 'zoho_eu_1' THEN 'DE'
      WHEN 'zoho_eu_2' THEN 'AT'
      ELSE 'DE'
    END
  );
$function$;

-- 2) Tenant restriction is pointless when the user already holds every reachable tenant code
CREATE OR REPLACE FUNCTION public.tenant_scope_restricted()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH u AS (SELECT public.user_tenant_codes() AS c)
  SELECT NOT public.is_admin()
     AND array_length(u.c, 1) IS NOT NULL
     AND NOT (
       (ARRAY(SELECT DISTINCT t.code FROM public.tenants t WHERE t.code IS NOT NULL) || ARRAY['DE','AT']::text[]) <@ u.c
     )
  FROM u;
$function$;

-- 3) Tenants policies: evaluate role checks once per statement
DROP POLICY IF EXISTS "tenants readable by admins or granted users" ON public.tenants;
CREATE POLICY "tenants readable by admins or granted users" ON public.tenants
  FOR SELECT TO authenticated
  USING ((SELECT public.is_admin()) OR EXISTS (
    SELECT 1 FROM public.user_tenant_access uta
    WHERE uta.user_id = (SELECT auth.uid()) AND uta.tenant_id = tenants.id));

DROP POLICY IF EXISTS "tenants manage super admin" ON public.tenants;
CREATE POLICY "tenants manage super admin" ON public.tenants
  FOR ALL TO authenticated
  USING ((SELECT public.has_role('Super Admin'::text)))
  WITH CHECK ((SELECT public.has_role('Super Admin'::text)));

-- 4) Personal lead customers: compute the allowed set once per statement
CREATE OR REPLACE FUNCTION lead_private.ml_customer_ids()
 RETURNS uuid[]
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(array_agg(DISTINCT l.converted_customer_id), ARRAY[]::uuid[])
  FROM public.sales_leads l
  WHERE l.converted_customer_id IS NOT NULL
    AND l.assigned_user = auth.uid()
    AND public.ml_can_access(l.id);
$function$;
REVOKE ALL ON FUNCTION lead_private.ml_customer_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION lead_private.ml_customer_ids() TO authenticated;

CREATE OR REPLACE FUNCTION public.ml_customer_ids()
 RETURNS uuid[]
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$ SELECT lead_private.ml_customer_ids() $function$;
REVOKE ALL ON FUNCTION public.ml_customer_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ml_customer_ids() TO authenticated, service_role;

DROP POLICY IF EXISTS ml_customer_select ON public.customers;
CREATE POLICY ml_customer_select ON public.customers
  FOR SELECT TO authenticated
  USING (id = ANY (((SELECT public.ml_customer_ids()))::uuid[]));

ANALYZE public.tenants;
ANALYZE public.customers;
ANALYZE public.orders;
ANALYZE public.order_items;
ANALYZE public.workspace_nav_items;
ANALYZE public.zoho_items;