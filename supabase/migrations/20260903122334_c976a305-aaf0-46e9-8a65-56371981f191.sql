REVOKE ALL ON FUNCTION public.mobile_my_devices() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mobile_revoke_devices(text, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mobile_my_devices() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mobile_revoke_devices(text, boolean, text) TO authenticated;