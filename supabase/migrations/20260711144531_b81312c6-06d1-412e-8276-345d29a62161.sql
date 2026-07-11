
REVOKE EXECUTE ON FUNCTION public.can_manage_media_packages() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_read_media_packages() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_access_media_package(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_write_media_package(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.calc_media_package_progress(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_media_packages() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_read_media_packages() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_access_media_package(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_write_media_package(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.calc_media_package_progress(uuid) TO authenticated, service_role;
