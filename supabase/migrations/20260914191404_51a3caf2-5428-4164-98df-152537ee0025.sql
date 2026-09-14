ALTER VIEW public.invoice_number_range_overview SET (security_invoker = on);

REVOKE EXECUTE ON FUNCTION public.next_invoice_number(date) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.assign_invoice_number(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.preview_invoice_renumbering(text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.run_invoice_renumbering(text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.correct_invoice_number(uuid, text, text, text, text) FROM anon, public;

GRANT EXECUTE ON FUNCTION public.next_invoice_number(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_invoice_number(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.preview_invoice_renumbering(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.run_invoice_renumbering(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.correct_invoice_number(uuid, text, text, text, text) TO authenticated;