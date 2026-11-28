REVOKE EXECUTE ON FUNCTION public.alixsmart_emit(text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.alixsmart_emit(text, jsonb) TO service_role;
REVOKE EXECUTE ON FUNCTION public.backup_watchdog_mark_stuck() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.backup_watchdog_mark_stuck() TO service_role;