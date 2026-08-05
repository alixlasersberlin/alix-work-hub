CREATE OR REPLACE FUNCTION public.main_dashboard_tenant_kpis(
  p_source_system text DEFAULT NULL,
  p_tenant_id uuid DEFAULT NULL,
  p_tenant_selected boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'freePoolDevices', (
      SELECT count(*) FROM public.lager_devices d
      WHERE (NOT p_tenant_selected OR (p_source_system IS NOT NULL AND d.source_system = p_source_system))
        AND coalesce(d.notes,'') NOT LIKE '%[Typ: Leihgerät]%'
        AND coalesce(d.notes,'') NOT LIKE '%[Leihgerät]%'
        AND d.reserved_order_id IS NULL
        AND coalesce(substring(d.notes from '\[Status:\s*([^\]]+)\]'), '') !~ '^\s*Hold\s*$'
    ),
    'leihgeraete', (
      SELECT count(*) FROM public.lager_devices d
      WHERE (NOT p_tenant_selected OR (p_source_system IS NOT NULL AND d.source_system = p_source_system))
        AND (coalesce(d.notes,'') LIKE '%[Typ: Leihgerät]%'
          OR coalesce(d.notes,'') LIKE '%[Leihgerät]%')
    ),
    'openOrders', (
      SELECT count(*) FROM public.orders o
      WHERE o.order_status = 'offen'
        AND (NOT p_tenant_selected OR (p_source_system IS NOT NULL AND o.source_system = p_source_system))
    ),
    'routes', (
      SELECT count(*) FROM public.route_plans r
      WHERE NOT p_tenant_selected OR (p_source_system IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.orders o WHERE o.id = r.order_id AND o.source_system = p_source_system
      ))
    ),
    'openFinance', (
      SELECT count(*) FROM public.finance_records f
      WHERE f.payment_status = 'offen'
        AND (NOT p_tenant_selected OR f.tenant_id = p_tenant_id)
    ),
    'vipCustomers', (
      SELECT count(*) FROM public.customers c
      WHERE c.is_vip = true
        AND (NOT p_tenant_selected OR (p_source_system IS NOT NULL AND c.source_system = p_source_system))
    ),
    'vipOrders', (
      SELECT count(*) FROM public.orders o
      WHERE o.is_vip = true
        AND (NOT p_tenant_selected OR (p_source_system IS NOT NULL AND o.source_system = p_source_system))
    )
  );
$function$;

REVOKE ALL ON FUNCTION public.main_dashboard_tenant_kpis(text, uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.main_dashboard_tenant_kpis(text, uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.main_dashboard_tenant_kpis(text, uuid, boolean) TO service_role;