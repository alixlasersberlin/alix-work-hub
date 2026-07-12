CREATE OR REPLACE FUNCTION public.esc_public_departments()
 RETURNS TABLE(id text, data jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    d.id,
    jsonb_build_object(
      'id', d.data->>'id',
      'name', d.data->>'name',
      'color', d.data->>'color',
      'icon', d.data->>'icon',
      'description', d.data->>'description',
      'active', COALESCE((d.data->>'active')::boolean, false),
      'publicBookable', COALESCE((d.data->>'publicBookable')::boolean, false),
      'externallyBookable', COALESCE((d.data->>'externallyBookable')::boolean, false),
      'defaultDurationMinutes', COALESCE((d.data->>'defaultDurationMinutes')::int, 60),
      'sortOrder', NULLIF(d.data->>'sortOrder','')::int
    ) AS data
  FROM public.esc_store_departments d
  WHERE COALESCE((d.data->>'active')::boolean, false) = true
    AND COALESCE((d.data->>'publicBookable')::boolean, false) = true
    AND COALESCE((d.data->>'externallyBookable')::boolean, false) = true
  ORDER BY COALESCE(NULLIF(d.data->>'sortOrder','')::int, 999), d.data->>'name';
$function$;