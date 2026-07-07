
CREATE OR REPLACE FUNCTION public.can_manage_tickets()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    public.is_admin()
    OR public.has_role('Kundenservice')
    OR public.has_role('Technik')
    OR public.has_role('SACHBEARBEITUNG')
    OR public.has_role('Auftragsverwaltung')
    OR public.has_role('Reparaturannahme')
    OR public.has_role('Order')
    OR public.has_role('Tourenplanung')
    OR public.has_role('Serviceleitung');
$function$;

CREATE OR REPLACE FUNCTION public.can_manage_repair()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public.is_admin()
      OR public.has_role('Order')
      OR public.has_role('Technik')
      OR public.has_role('Reparaturannahme')
      OR public.has_role('Österreich')
      OR public.has_role('SACHBEARBEITUNG')
      OR public.has_role('Auftragsverwaltung')
      OR public.has_role('Tourenplanung')
      OR public.has_role('Kundenservice')
      OR public.has_role('Serviceleitung');
$function$;
