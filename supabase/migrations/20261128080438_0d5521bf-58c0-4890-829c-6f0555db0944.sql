REVOKE EXECUTE ON FUNCTION public.collect_sync_cases() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.collect_sync_cases() TO service_role;