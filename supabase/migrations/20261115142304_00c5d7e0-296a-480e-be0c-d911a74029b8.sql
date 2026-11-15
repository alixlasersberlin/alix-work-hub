CREATE OR REPLACE FUNCTION public.is_internal_staff()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT auth.uid() IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.customer_portal_users WHERE user_id = auth.uid())
     AND NOT public.has_role('Lieferant')
     AND NOT public.has_role('Lieferant Jerry')
     AND NOT (
       public.has_role('Angebotsersteller')
       AND NOT EXISTS (
         SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id = ur.role_id
         WHERE ur.user_id = auth.uid() AND r.name <> 'Angebotsersteller'
       )
     )
$function$;