
REVOKE EXECUTE ON FUNCTION public.gobd_restore_guard() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.gobd_restore_begin(uuid, text, timestamptz, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.gobd_restore_load(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.gobd_restore_compare(uuid, jsonb, text[]) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.gobd_restore_protection_tests(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.gobd_restore_legal_hold_test(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.gobd_restore_finish(uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.gobd_restore_run_worm() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.gobd_phase15_check() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gobd_phase15_check() TO authenticated;
GRANT EXECUTE ON FUNCTION public.gobd_restore_begin(uuid, text, timestamptz, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gobd_restore_load(uuid, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.gobd_restore_compare(uuid, jsonb, text[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.gobd_restore_protection_tests(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.gobd_restore_legal_hold_test(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.gobd_restore_finish(uuid, boolean) TO service_role;
