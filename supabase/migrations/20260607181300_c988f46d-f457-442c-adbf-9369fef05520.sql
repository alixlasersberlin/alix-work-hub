
CREATE OR REPLACE FUNCTION public.can_access_mail()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    public.is_admin()
    OR public.has_role('Geschäftsführung')
    OR public.has_role('Marketing')
    OR public.has_role('Finance')
    OR public.has_role('Technik')
    OR public.has_role('Kundenservice')
    OR public.has_role('Vertrieb')
    OR public.has_role('Reparaturannahme')
    OR public.has_role('Tourenplanung')
    OR public.has_role('Bestellwesen')
    OR public.has_role('Order')
    OR public.has_role('Read Only')
    OR public.has_role('Read Only Audit')
    OR public.has_role('Österreich');
$function$;
