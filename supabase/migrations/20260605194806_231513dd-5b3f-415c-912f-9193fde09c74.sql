
CREATE OR REPLACE FUNCTION public.can_access_repair()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    public.is_admin()
    OR public.has_role('Order')
    OR public.has_role('Technik')
    OR public.has_role('Finance')
    OR public.has_role('Tourenplanung');
$function$;
