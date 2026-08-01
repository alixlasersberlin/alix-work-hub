CREATE OR REPLACE FUNCTION public.release_device_locks_on_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_paid boolean;
BEGIN
  is_paid := (lower(coalesce(NEW.status,'')) IN ('paid','bezahlt','closed'))
             OR (NEW.balance IS NOT NULL AND NEW.balance <= 0);

  IF NOT is_paid THEN
    RETURN NEW;
  END IF;

  UPDATE public.device_locks dl
     SET status = 'aufgehoben',
         released_at = now(),
         lock_note = coalesce(dl.lock_note || ' | ', '')
                     || 'Automatisch aufgehoben: Rechnung '
                     || coalesce(NEW.invoice_number, '') || ' bezahlt am '
                     || to_char(now(), 'DD.MM.YYYY'),
         updated_at = now()
   WHERE dl.status NOT IN ('aufgehoben')
     AND (
          (NEW.invoice_number IS NOT NULL AND dl.invoice_number = NEW.invoice_number)
          OR dl.invoice_id = NEW.id
         );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_release_device_locks_on_payment ON public.zoho_invoices;
CREATE TRIGGER trg_release_device_locks_on_payment
AFTER UPDATE OF status, balance ON public.zoho_invoices
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status OR OLD.balance IS DISTINCT FROM NEW.balance)
EXECUTE FUNCTION public.release_device_locks_on_payment();

DROP TRIGGER IF EXISTS trg_release_device_locks_on_payment_rec ON public.zoho_recurring_invoices;
CREATE TRIGGER trg_release_device_locks_on_payment_rec
AFTER UPDATE OF status, balance ON public.zoho_recurring_invoices
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status OR OLD.balance IS DISTINCT FROM NEW.balance)
EXECUTE FUNCTION public.release_device_locks_on_payment();