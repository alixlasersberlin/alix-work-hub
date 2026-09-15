
CREATE TRIGGER trg_gobd_retention_zoho_invoices BEFORE DELETE ON public.zoho_invoices
  FOR EACH ROW EXECUTE FUNCTION public.gobd_retention_delete_guard('INVOICE');
CREATE TRIGGER trg_gobd_retention_invoice_corrections BEFORE DELETE ON public.invoice_corrections
  FOR EACH ROW EXECUTE FUNCTION public.gobd_retention_delete_guard('INVOICE_CORRECTION');
CREATE TRIGGER trg_gobd_retention_bank_transactions BEFORE DELETE ON public.bank_transactions
  FOR EACH ROW EXECUTE FUNCTION public.gobd_retention_delete_guard('PAYMENT');
CREATE TRIGGER trg_gobd_retention_bank_alloc BEFORE DELETE ON public.bank_transaction_allocations
  FOR EACH ROW EXECUTE FUNCTION public.gobd_retention_delete_guard('PAYMENT_ALLOCATION');
CREATE TRIGGER trg_gobd_retention_bank_imports BEFORE DELETE ON public.bank_imports
  FOR EACH ROW EXECUTE FUNCTION public.gobd_retention_delete_guard('BANK_IMPORT');
CREATE TRIGGER trg_gobd_retention_bank_matches BEFORE DELETE ON public.bank_transaction_matches
  FOR EACH ROW EXECUTE FUNCTION public.gobd_retention_delete_guard('PAYMENT_ALLOCATION');

REVOKE ALL ON FUNCTION public.gobd_retention_delete_guard() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.gobd_data_class_audit() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.gobd_legal_hold_audit() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.gobd_deletion_request_audit() FROM public, anon, authenticated;
