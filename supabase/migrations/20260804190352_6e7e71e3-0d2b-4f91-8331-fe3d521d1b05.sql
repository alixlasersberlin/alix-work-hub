CREATE OR REPLACE FUNCTION public.main_dashboard_kpis(p_at_only boolean DEFAULT false)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'freePoolDevices', (
      SELECT count(*) FROM public.lager_devices d
      WHERE coalesce(d.notes,'') NOT LIKE '%[Typ: Leihgerät]%'
        AND coalesce(d.notes,'') NOT LIKE '%[Leihgerät]%'
        AND d.reserved_order_id IS NULL
        AND coalesce(substring(d.notes from '\[Status:\s*([^\]]+)\]'), '') !~ '^\s*Hold\s*$'
    ),
    'leihgeraete', (
      SELECT count(*) FROM public.lager_devices d
      WHERE coalesce(d.notes,'') LIKE '%[Typ: Leihgerät]%'
         OR coalesce(d.notes,'') LIKE '%[Leihgerät]%'
    ),
    'openOrders', (
      SELECT count(*) FROM public.orders o
      WHERE o.order_status = 'offen'
        AND (NOT p_at_only OR o.source_system = 'zoho_eu_2')
    ),
    'routes', (
      SELECT count(*) FROM public.route_plans r
      WHERE NOT p_at_only OR EXISTS (
        SELECT 1 FROM public.orders o WHERE o.id = r.order_id AND o.source_system = 'zoho_eu_2'
      )
    ),
    'openFinance', (
      SELECT count(*) FROM public.finance_records f WHERE f.payment_status = 'offen'
    ),
    'vipCustomers', (
      SELECT count(*) FROM public.customers c
      WHERE c.is_vip = true AND (NOT p_at_only OR c.source_system = 'zoho_eu_2')
    ),
    'vipOrders', (
      SELECT count(*) FROM public.orders o
      WHERE o.is_vip = true AND (NOT p_at_only OR o.source_system = 'zoho_eu_2')
    )
  );
$$;

REVOKE ALL ON FUNCTION public.main_dashboard_kpis(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.main_dashboard_kpis(boolean) TO authenticated;