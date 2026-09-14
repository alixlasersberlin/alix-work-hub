
DELETE FROM public.gobd_export_log WHERE export_type IN ('TESTLAUF_EXPORT','TESTLAUF_PHASE3_ERGEBNIS');

CREATE OR REPLACE FUNCTION public.gobd_worm_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  RAISE EXCEPTION 'GoBD: Protokolleintraege sind unveraenderbar (%, %)', TG_TABLE_NAME, TG_OP;
END; $$;
REVOKE ALL ON FUNCTION public.gobd_worm_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_worm_invoice_audit_log ON public.invoice_audit_log;
CREATE TRIGGER trg_worm_invoice_audit_log BEFORE UPDATE OR DELETE ON public.invoice_audit_log
FOR EACH ROW EXECUTE FUNCTION public.gobd_worm_guard();

DROP TRIGGER IF EXISTS trg_worm_gobd_export_log ON public.gobd_export_log;
CREATE TRIGGER trg_worm_gobd_export_log BEFORE UPDATE OR DELETE ON public.gobd_export_log
FOR EACH ROW EXECUTE FUNCTION public.gobd_worm_guard();

DROP TRIGGER IF EXISTS trg_worm_invoice_number_audit ON public.invoice_number_audit;
CREATE TRIGGER trg_worm_invoice_number_audit BEFORE UPDATE OR DELETE ON public.invoice_number_audit
FOR EACH ROW EXECUTE FUNCTION public.gobd_worm_guard();

DROP TRIGGER IF EXISTS trg_worm_audit_logs ON public.audit_logs;
CREATE TRIGGER trg_worm_audit_logs BEFORE UPDATE OR DELETE ON public.audit_logs
FOR EACH ROW EXECUTE FUNCTION public.gobd_worm_guard();

DROP TRIGGER IF EXISTS trg_worm_invoice_corrections ON public.invoice_corrections;
CREATE TRIGGER trg_worm_invoice_corrections BEFORE DELETE ON public.invoice_corrections
FOR EACH ROW EXECUTE FUNCTION public.gobd_worm_guard();
