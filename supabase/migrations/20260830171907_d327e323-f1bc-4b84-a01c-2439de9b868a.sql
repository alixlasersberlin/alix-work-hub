REVOKE EXECUTE ON FUNCTION public.compliance_is_admin() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.compliance_has_access() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.compliance_is_member(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.compliance_can_write(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.compliance_is_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.compliance_has_access() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.compliance_is_member(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.compliance_can_write(uuid) TO authenticated, service_role;