
CREATE OR REPLACE FUNCTION public.can_access_repair()
 RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT public.is_admin()
      OR public.has_role('Order')
      OR public.has_role('Technik')
      OR public.has_role('Finance')
      OR public.has_role('Tourenplanung')
      OR public.has_role('Reparaturannahme')
      OR public.has_role('Österreich');
$$;

CREATE OR REPLACE FUNCTION public.can_manage_repair()
 RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT public.is_admin()
      OR public.has_role('Order')
      OR public.has_role('Technik')
      OR public.has_role('Reparaturannahme')
      OR public.has_role('Österreich');
$$;

CREATE OR REPLACE FUNCTION public.can_access_warranty()
 RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT public.is_admin()
      OR public.has_role('Service')
      OR public.has_role('Serviceleitung')
      OR public.has_role('Technik')
      OR public.has_role('Reparaturannahme')
      OR public.has_role('Finance')
      OR public.has_role('Tourenplanung')
      OR public.has_role('Kundenservice')
      OR public.has_role('Österreich');
$$;

CREATE OR REPLACE FUNCTION public.can_access_ai_service()
 RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT public.is_admin()
      OR public.has_role('Service')
      OR public.has_role('Technik')
      OR public.has_role('Kundenservice')
      OR public.has_role('Reparaturannahme')
      OR public.has_role('Finance')
      OR public.has_role('Österreich');
$$;

CREATE OR REPLACE FUNCTION public.can_run_ai_service()
 RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT public.is_admin()
      OR public.has_role('Service')
      OR public.has_role('Technik')
      OR public.has_role('Kundenservice')
      OR public.has_role('Reparaturannahme')
      OR public.has_role('Österreich');
$$;
