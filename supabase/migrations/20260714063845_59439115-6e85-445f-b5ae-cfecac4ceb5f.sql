REVOKE ALL ON FUNCTION public.is_device_active(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_device_active(uuid) TO authenticated, service_role;