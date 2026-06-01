CREATE OR REPLACE FUNCTION public.can_access_qm()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT auth.uid() IS NOT NULL;
$function$;