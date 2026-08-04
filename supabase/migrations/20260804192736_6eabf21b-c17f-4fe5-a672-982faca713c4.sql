CREATE OR REPLACE FUNCTION public.lager_overview_counts()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH d AS (
    SELECT
      coalesce(trim(substring(notes from '\[Status:\s*([^\]]+)\]')), '') AS status,
      (coalesce(notes,'') LIKE '%[Typ: Leihgerät]%' OR coalesce(notes,'') LIKE '%[Leihgerät]%') AS is_leih
    FROM public.lager_devices
    WHERE reserved_order_id IS NULL
  )
  SELECT jsonb_build_object(
    'transfer', count(*) FILTER (WHERE status = 'Transfer'),
    'produktion', count(*) FILTER (WHERE status = 'Produktion'),
    'leih', count(*) FILTER (WHERE status NOT IN ('Transfer','Produktion') AND is_leih),
    'lager', count(*) FILTER (WHERE status NOT IN ('Transfer','Produktion') AND NOT is_leih)
  )
  FROM d;
$function$;

REVOKE ALL ON FUNCTION public.lager_overview_counts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lager_overview_counts() TO authenticated, service_role;