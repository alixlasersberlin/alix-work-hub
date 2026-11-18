CREATE OR REPLACE FUNCTION public.can_use_alix_sign()
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT public.is_admin()
      OR public.has_role('Order')
      OR public.has_role('Vertrieb')
      OR public.has_role('Finance')
      OR public.has_role('Geschäftsführung')
      OR public.has_role('Angebotsersteller');
$$;