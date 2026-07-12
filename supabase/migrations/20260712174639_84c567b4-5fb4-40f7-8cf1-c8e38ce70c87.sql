
DROP VIEW IF EXISTS public.v_temp_grants_expiring_soon;
CREATE VIEW public.v_temp_grants_expiring_soon
WITH (security_invoker=true) AS
  SELECT g.*, EXTRACT(EPOCH FROM (g.valid_until - now()))/3600 AS hours_left
    FROM public.role_temporary_grants g
   WHERE g.status = 'active'
     AND g.valid_until > now()
     AND g.valid_until <= now() + interval '24 hours';
GRANT SELECT ON public.v_temp_grants_expiring_soon TO authenticated;
