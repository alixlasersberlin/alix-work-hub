
CREATE OR REPLACE FUNCTION public.hoo_mandanten_stats()
RETURNS TABLE(
  customers_total bigint, customers_de bigint, customers_at bigint,
  orders_total bigint, orders_de bigint, orders_at bigint,
  revenue_de numeric, revenue_at numeric
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  RETURN QUERY
  SELECT
    (SELECT count(*) FROM public.customers),
    (SELECT count(*) FROM public.customers WHERE source_system = 'zoho_eu_1'),
    (SELECT count(*) FROM public.customers WHERE source_system = 'zoho_eu_2'),
    (SELECT count(*) FROM public.orders),
    (SELECT count(*) FROM public.orders WHERE source_system = 'zoho_eu_1'),
    (SELECT count(*) FROM public.orders WHERE source_system = 'zoho_eu_2'),
    (SELECT COALESCE(sum(total_amount),0) FROM public.orders WHERE source_system = 'zoho_eu_1'),
    (SELECT COALESCE(sum(total_amount),0) FROM public.orders WHERE source_system = 'zoho_eu_2');
END;
$$;

REVOKE ALL ON FUNCTION public.hoo_mandanten_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hoo_mandanten_stats() TO authenticated;
