
-- Zahlungszuordnungen
CREATE OR REPLACE FUNCTION public.gobd_payment_alloc_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_action text; v_rec jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN v_action := 'PAYMENT_ASSIGNED'; v_rec := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN v_action := 'PAYMENT_REASSIGNED'; v_rec := jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW));
  ELSE v_action := 'PAYMENT_UNASSIGNED'; v_rec := to_jsonb(OLD);
  END IF;
  INSERT INTO public.audit_logs(user_id, action, module, record_id, details)
  VALUES (auth.uid(), v_action, TG_TABLE_NAME, coalesce(NEW.id, OLD.id)::text, v_rec);
  RETURN coalesce(NEW, OLD);
END; $$;

DROP TRIGGER IF EXISTS trg_gobd_alloc_audit ON public.bank_transaction_allocations;
CREATE TRIGGER trg_gobd_alloc_audit AFTER INSERT OR UPDATE OR DELETE ON public.bank_transaction_allocations
FOR EACH ROW EXECUTE FUNCTION public.gobd_payment_alloc_audit();

DROP TRIGGER IF EXISTS trg_gobd_match_audit ON public.bank_transaction_matches;
CREATE TRIGGER trg_gobd_match_audit AFTER INSERT OR UPDATE OR DELETE ON public.bank_transaction_matches
FOR EACH ROW EXECUTE FUNCTION public.gobd_payment_alloc_audit();

-- Ruecklastschriften
CREATE OR REPLACE FUNCTION public.gobd_chargeback_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.audit_logs(user_id, action, module, record_id, details)
  VALUES (auth.uid(), 'CHARGEBACK_CREATED', 'bank_return_debits', NEW.id::text, to_jsonb(NEW));
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_gobd_chargeback_audit ON public.bank_return_debits;
CREATE TRIGGER trg_gobd_chargeback_audit AFTER INSERT ON public.bank_return_debits
FOR EACH ROW EXECUTE FUNCTION public.gobd_chargeback_audit();

-- Bankimporte
CREATE OR REPLACE FUNCTION public.gobd_bank_import_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_status text := lower(coalesce(to_jsonb(NEW) ->> 'status', ''));
        v_action text;
BEGIN
  IF TG_OP = 'INSERT' THEN v_action := 'BANK_IMPORT_STARTED';
  ELSIF v_status IN ('failed','fehler','error') THEN v_action := 'BANK_IMPORT_FAILED';
  ELSIF v_status IN ('completed','done','fertig','abgeschlossen','imported') THEN v_action := 'BANK_IMPORT_COMPLETED';
  ELSE RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND to_jsonb(NEW) ->> 'status' IS NOT DISTINCT FROM to_jsonb(OLD) ->> 'status' THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.audit_logs(user_id, action, module, record_id, details)
  VALUES (auth.uid(), v_action, 'bank_imports', NEW.id::text, to_jsonb(NEW));
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_gobd_bank_import_audit ON public.bank_imports;
CREATE TRIGGER trg_gobd_bank_import_audit AFTER INSERT OR UPDATE ON public.bank_imports
FOR EACH ROW EXECUTE FUNCTION public.gobd_bank_import_audit();

-- Buchungsperioden
CREATE OR REPLACE FUNCTION public.gobd_period_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_action text;
BEGIN
  IF TG_OP = 'INSERT' THEN v_action := 'ACCOUNTING_PERIOD_CREATED';
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    v_action := CASE NEW.status
      WHEN 'soft_closed' THEN 'ACCOUNTING_PERIOD_SOFT_CLOSED'
      WHEN 'hard_locked' THEN 'ACCOUNTING_PERIOD_HARD_LOCKED'
      WHEN 'open' THEN 'ACCOUNTING_PERIOD_REOPENED'
      ELSE 'ACCOUNTING_PERIOD_CHANGED' END;
  ELSE RETURN NEW;
  END IF;
  INSERT INTO public.audit_logs(user_id, action, module, record_id, details)
  VALUES (auth.uid(), v_action, 'finance_periods', NEW.id::text,
          jsonb_build_object('region', NEW.accounting_region, 'jahr', NEW.fiscal_year,
                             'monat', NEW.period_month, 'status', NEW.status, 'note', NEW.note));
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_gobd_period_audit ON public.finance_periods;
CREATE TRIGGER trg_gobd_period_audit AFTER INSERT OR UPDATE ON public.finance_periods
FOR EACH ROW EXECUTE FUNCTION public.gobd_period_audit();
