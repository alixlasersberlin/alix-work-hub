REVOKE ALL ON FUNCTION public.get_current_user_role_names() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_current_user_role_names() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_current_user_role_names() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_user_role_names() TO service_role;