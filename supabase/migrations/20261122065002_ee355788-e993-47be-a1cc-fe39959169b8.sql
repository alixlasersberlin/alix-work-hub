REVOKE EXECUTE ON FUNCTION public.housekeeping_purge_logs() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.housekeeping_purge_logs() TO service_role;