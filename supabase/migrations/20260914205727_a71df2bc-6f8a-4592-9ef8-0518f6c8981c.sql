REVOKE ALL ON FUNCTION public.gobd_invoice_guard() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.gobd_period_guard() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.gobd_period_state(accounting_region, date) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.gobd_period_state(accounting_region, date) TO authenticated;
REVOKE ALL ON FUNCTION public.gobd_is_service_context() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.gobd_is_service_context() TO authenticated;
REVOKE ALL ON FUNCTION public.gobd_invoice_is_final(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.gobd_invoice_is_final(text) TO authenticated;