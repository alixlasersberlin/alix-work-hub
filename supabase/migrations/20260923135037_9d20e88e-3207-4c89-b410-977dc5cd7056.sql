CREATE OR REPLACE FUNCTION public.sidebar_lager_counts()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH r AS (
    SELECT
      trim((regexp_match(coalesce(notes,''), '.*\[Status:\s*([^\]]+)\]'))[1]) AS raw_status,
      (coalesce(notes,'') LIKE '%[Typ: Leihgerät]%' OR coalesce(notes,'') LIKE '%[Leihgerät]%') AS is_leih,
      reserved_order_id
    FROM public.lager_devices
  ), d AS (
    SELECT
      CASE
        WHEN raw_status IS NULL OR raw_status = '' THEN 'Bestand'
        WHEN raw_status ~* '^in\s+produktion$' THEN 'Produktion'
        WHEN raw_status ~* '^lagereingang$' THEN 'Bestand'
        ELSE raw_status
      END AS status,
      is_leih,
      reserved_order_id
    FROM r
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
$function$;