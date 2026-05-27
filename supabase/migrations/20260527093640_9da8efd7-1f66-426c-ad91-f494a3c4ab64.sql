GRANT EXECUTE ON FUNCTION public.set_factory_invoice_pdf(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_factory_invoice_pdf(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_factory_invoice_payment_ok(uuid, boolean) TO authenticated;