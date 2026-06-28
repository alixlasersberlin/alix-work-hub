REVOKE ALL ON FUNCTION public.as_force_close_case(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.as_force_close_case(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.as_force_close_case(uuid, text) TO authenticated;