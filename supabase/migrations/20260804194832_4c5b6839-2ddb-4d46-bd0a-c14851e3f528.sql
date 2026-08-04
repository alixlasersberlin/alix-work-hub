CREATE OR REPLACE FUNCTION public.order_status_counts(p_order_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'production_orders', (SELECT count(*) FROM public.production_orders WHERE order_id = p_order_id),
    'reserviert', (SELECT count(*) FROM public.lager_devices WHERE reserved_order_id = p_order_id),
    'geliefert', (SELECT count(*) FROM public.lager_devices WHERE delivered_order_id = p_order_id),
    'route_plans', (SELECT count(*) FROM public.route_plans WHERE order_id = p_order_id)
  );
$$;

REVOKE EXECUTE ON FUNCTION public.order_status_counts(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.order_status_counts(uuid) TO authenticated, service_role;