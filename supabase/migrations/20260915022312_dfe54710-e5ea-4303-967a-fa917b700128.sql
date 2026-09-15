
REVOKE ALL ON FUNCTION public.gobd_number_range_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gobd_period_delete_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gobd_no_delete() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gobd_compliance_check() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gobd_compliance_check() TO authenticated, service_role;
