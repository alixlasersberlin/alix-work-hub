
CREATE OR REPLACE FUNCTION public.tickets_seed_customer_reminder()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  days INTEGER := 3;
BEGIN
  IF NEW.comm_status = 'awaiting_customer'
     AND (TG_OP = 'INSERT' OR OLD.comm_status IS DISTINCT FROM NEW.comm_status) THEN

    IF NEW.ticket_department_id IS NOT NULL THEN
      SELECT COALESCE(reminder_after_days, 3) INTO days
      FROM public.ticket_departments
      WHERE id = NEW.ticket_department_id;
    END IF;

    NEW.next_customer_reminder_at := now() + make_interval(days => COALESCE(days, 3));
    NEW.customer_reminder_count   := 0;
    NEW.comm_status_since         := COALESCE(NEW.comm_status_since, now());
  ELSIF TG_OP = 'UPDATE'
        AND OLD.comm_status = 'awaiting_customer'
        AND NEW.comm_status IS DISTINCT FROM OLD.comm_status THEN
    NEW.next_customer_reminder_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tickets_seed_customer_reminder ON public.tickets;
CREATE TRIGGER trg_tickets_seed_customer_reminder
BEFORE INSERT OR UPDATE OF comm_status ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.tickets_seed_customer_reminder();

-- Backfill: bereits wartende Tickets ohne Reminder-Termin auf +3 Tage setzen
UPDATE public.tickets
SET next_customer_reminder_at = COALESCE(comm_status_since, now()) + interval '3 days'
WHERE comm_status = 'awaiting_customer'
  AND next_customer_reminder_at IS NULL;
