
ALTER TABLE public.survey_alerts ADD COLUMN IF NOT EXISTS capa_id uuid REFERENCES public.capas(id) ON DELETE SET NULL;

INSERT INTO public.roles (name, description)
SELECT 'Feedback', 'Zugriff auf das Modul Umfragen & Feedback'
WHERE NOT EXISTS (SELECT 1 FROM public.roles WHERE name = 'Feedback');

CREATE OR REPLACE FUNCTION public.sv_can_read()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public.has_role('Super Admin') OR public.has_role('Admin') OR public.has_role('Marketing')
      OR public.has_role('Management') OR public.has_role('Geschäftsführung') OR public.has_role('Service')
      OR public.has_role('Vertrieb') OR public.has_role('Verkauf') OR public.has_role('QM')
      OR public.has_role('Feedback');
$function$;

CREATE OR REPLACE FUNCTION public.sv_can_write()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public.has_role('Super Admin') OR public.has_role('Admin') OR public.has_role('Marketing')
      OR public.has_role('Feedback');
$function$;
