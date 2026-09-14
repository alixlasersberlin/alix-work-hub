
REVOKE ALL ON FUNCTION public.gobd_payment_alloc_audit() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gobd_chargeback_audit() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gobd_bank_import_audit() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gobd_period_audit() FROM PUBLIC, anon, authenticated;
