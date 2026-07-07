CREATE OR REPLACE FUNCTION public.get_current_user_role_names()
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(array_agg(r.name ORDER BY r.name), ARRAY[]::text[])
  FROM public.user_roles ur
  JOIN public.roles r ON r.id = ur.role_id
  WHERE ur.user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.get_current_user_role_names() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_current_user_role_names() TO authenticated;