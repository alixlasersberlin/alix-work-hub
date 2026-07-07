-- Fix recurring PG log errors: missing columns tickets.subject, tickets.ticket_number, finance_reminders.customer_name

-- tickets: add subject/ticket_number as generated columns (aliases to existing data)
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS subject text GENERATED ALWAYS AS (title) STORED;

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS ticket_number text GENERATED ALWAYS AS (external_ticket_id) STORED;

-- finance_reminders: add customer_name (populated by trigger from customers table)
ALTER TABLE public.finance_reminders
  ADD COLUMN IF NOT EXISTS customer_name text;

CREATE OR REPLACE FUNCTION public.set_finance_reminder_customer_name()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.customer_id IS NOT NULL AND (NEW.customer_name IS NULL OR NEW.customer_name = '') THEN
    SELECT COALESCE(c.company_name, c.contact_name, c.email)
      INTO NEW.customer_name
    FROM public.customers c
    WHERE c.id = NEW.customer_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_finance_reminder_customer_name ON public.finance_reminders;
CREATE TRIGGER trg_set_finance_reminder_customer_name
BEFORE INSERT OR UPDATE OF customer_id ON public.finance_reminders
FOR EACH ROW
EXECUTE FUNCTION public.set_finance_reminder_customer_name();

-- Backfill existing rows
UPDATE public.finance_reminders r
SET customer_name = COALESCE(c.company_name, c.contact_name, c.email)
FROM public.customers c
WHERE r.customer_id = c.id
  AND (r.customer_name IS NULL OR r.customer_name = '');