REVOKE EXECUTE ON FUNCTION public.check_user_profile_self_update() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.log_order_status_change() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.clear_factory_invoice_pdf(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.set_factory_invoice_pdf(uuid, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.set_factory_invoice_payment_ok(uuid, boolean) FROM authenticated;