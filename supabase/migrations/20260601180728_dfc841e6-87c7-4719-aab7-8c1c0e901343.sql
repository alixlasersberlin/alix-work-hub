REVOKE EXECUTE ON FUNCTION public.can_access_qm() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_qm() TO authenticated, service_role;