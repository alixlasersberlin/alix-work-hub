CREATE OR REPLACE FUNCTION public.sidebar_lager_counts()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH d AS (
    SELECT
      coalesce(trim(substring(notes from '\[Status:\s*([^\]]+)\]')), '') AS status,
      (coalesce(notes,'') LIKE '%[Typ: Leihgerät]%' OR coalesce(notes,'') LIKE '%[Leihgerät]%') AS is_leih,
      reserved_order_id
    FROM public.lager_devices
  )
  SELECT jsonb_build_object(
    'transfer', count(*) FILTER (WHERE status = 'Transfer'),
    'produktion', count(*) FILTER (WHERE status = 'Produktion'),
    'hold', count(*) FILTER (WHERE status = 'Hold'),
    'warehouse', count(*) FILTER (WHERE status = 'Shell Warehouse' AND reserved_order_id IS NULL),
    'ausgeliefert', count(*) FILTER (WHERE status = 'Ausgeliefert'),
    'leih', count(*) FILTER (WHERE status NOT IN ('Transfer','Produktion','Hold','Shell Warehouse','Ausgeliefert') AND is_leih),
    'lager', count(*) FILTER (WHERE status NOT IN ('Transfer','Produktion','Hold','Shell Warehouse','Ausgeliefert') AND NOT is_leih)
  )
  FROM d;
$$;

REVOKE ALL ON FUNCTION public.sidebar_lager_counts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sidebar_lager_counts() TO authenticated;