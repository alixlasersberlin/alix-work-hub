
REVOKE EXECUTE ON FUNCTION public.credit_can_access() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.credit_is_super_admin() FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.credit_can_access() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.credit_is_super_admin() TO authenticated, service_role;
