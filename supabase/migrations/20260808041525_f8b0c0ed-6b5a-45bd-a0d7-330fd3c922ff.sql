
ALTER TABLE public.zoho_invoices
  ADD COLUMN IF NOT EXISTS is_deposit boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deposit_id uuid;
ALTER TABLE public.zoho_recurring_invoices
  ADD COLUMN IF NOT EXISTS is_deposit boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deposit_id uuid;

ALTER TABLE public.finance_deposits
  ADD COLUMN IF NOT EXISTS linked_invoice_table text,
  ADD COLUMN IF NOT EXISTS linked_invoice_id uuid;

CREATE INDEX IF NOT EXISTS idx_zoho_invoices_is_deposit ON public.zoho_invoices(is_deposit);
CREATE INDEX IF NOT EXISTS idx_zoho_rec_invoices_is_deposit ON public.zoho_recurring_invoices(is_deposit);
CREATE INDEX IF NOT EXISTS idx_finance_deposits_linked_invoice ON public.finance_deposits(linked_invoice_table, linked_invoice_id);

-- Anzahlung gebucht/bezahlt -> verknüpfte Rechnung als bezahlt markieren
CREATE OR REPLACE FUNCTION public.finance_deposit_sync_invoice_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.linked_invoice_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.status IN ('gebucht','bezahlt') AND COALESCE(OLD.status,'') NOT IN ('gebucht','bezahlt') THEN
    IF NEW.linked_invoice_table = 'zoho_recurring_invoices' THEN
      UPDATE public.zoho_recurring_invoices
        SET balance = 0, payment_status = 'Bezahlt', status = 'paid',
            last_payment_date = COALESCE(last_payment_date, CURRENT_DATE), updated_at = now()
        WHERE id = NEW.linked_invoice_id;
    ELSE
      UPDATE public.zoho_invoices
        SET balance = 0, payment_status = 'Bezahlt', status = 'paid',
            last_payment_date = COALESCE(last_payment_date, CURRENT_DATE), updated_at = now()
        WHERE id = NEW.linked_invoice_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_finance_deposit_sync_invoice_paid ON public.finance_deposits;
CREATE TRIGGER trg_finance_deposit_sync_invoice_paid
AFTER UPDATE OF status ON public.finance_deposits
FOR EACH ROW EXECUTE FUNCTION public.finance_deposit_sync_invoice_paid();

-- Rechnung bezahlt -> verknüpfte Anzahlung als gebucht markieren
CREATE OR REPLACE FUNCTION public.zoho_invoice_sync_deposit_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.deposit_id IS NULL THEN RETURN NEW; END IF;
  IF (COALESCE(NEW.balance, 0) <= 0.009 OR lower(COALESCE(NEW.payment_status,'')) LIKE '%bezahlt%' OR lower(COALESCE(NEW.status,'')) = 'paid')
     AND NOT (lower(COALESCE(NEW.payment_status,'')) LIKE '%teil%') THEN
    UPDATE public.finance_deposits
      SET status = 'gebucht',
          paid_amount = GREATEST(paid_amount, gross_amount),
          updated_at = now()
      WHERE id = NEW.deposit_id AND status NOT IN ('gebucht','bezahlt');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_zoho_invoices_sync_deposit_paid ON public.zoho_invoices;
CREATE TRIGGER trg_zoho_invoices_sync_deposit_paid
AFTER UPDATE ON public.zoho_invoices
FOR EACH ROW EXECUTE FUNCTION public.zoho_invoice_sync_deposit_paid();

DROP TRIGGER IF EXISTS trg_zoho_rec_invoices_sync_deposit_paid ON public.zoho_recurring_invoices;
CREATE TRIGGER trg_zoho_rec_invoices_sync_deposit_paid
AFTER UPDATE ON public.zoho_recurring_invoices
FOR EACH ROW EXECUTE FUNCTION public.zoho_invoice_sync_deposit_paid();
