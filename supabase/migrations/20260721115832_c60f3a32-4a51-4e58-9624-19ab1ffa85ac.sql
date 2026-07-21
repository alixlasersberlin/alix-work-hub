-- Grant Admin the same effective privileges as Super Admin across all RLS.
-- Any check for has_role('Super Admin') now also passes when the user has 'Admin'.
CREATE OR REPLACE FUNCTION public.has_role(check_role text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
      and (
        r.name = check_role
        -- Admin inherits Super Admin
        or (check_role = 'Super Admin' and r.name = 'Admin')
      )
  );
$function$;