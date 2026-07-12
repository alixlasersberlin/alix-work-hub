
-- Enum for communication status
DO $$ BEGIN
  CREATE TYPE public.ticket_comm_status AS ENUM (
    'none',
    'awaiting_customer',
    'awaiting_agent',
    'awaiting_internal',
    'awaiting_appointment_confirm',
    'customer_unreachable',
    'customer_replied',
    'closed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Extend tickets
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS comm_status public.ticket_comm_status NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS comm_status_since timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_customer_reply_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_agent_reply_at timestamptz,
  ADD COLUMN IF NOT EXISTS customer_reminder_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_customer_reminder_at timestamptz;

-- Extend ticket_departments
ALTER TABLE public.ticket_departments
  ADD COLUMN IF NOT EXISTS sla_hours integer NOT NULL DEFAULT 24,
  ADD COLUMN IF NOT EXISTS reminder_after_days integer NOT NULL DEFAULT 3;

-- Trigger function to update comm_status based on new messages
CREATE OR REPLACE FUNCTION public.tickets_update_comm_status_on_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_status public.ticket_comm_status;
  v_reminder_days integer;
BEGIN
  IF NEW.is_internal THEN
    RETURN NEW;
  END IF;

  IF NEW.sender_type = 'customer' THEN
    v_new_status := 'customer_replied';
    UPDATE public.tickets
       SET comm_status = v_new_status,
           comm_status_since = now(),
           last_customer_reply_at = now(),
           customer_reminder_count = 0,
           next_customer_reminder_at = NULL,
           updated_at = now()
     WHERE id = NEW.ticket_id;
  ELSIF NEW.sender_type IN ('agent','system','department') THEN
    v_reminder_days := 3;
    SELECT COALESCE(td.reminder_after_days, 3) INTO v_reminder_days
      FROM public.tickets t
      LEFT JOIN public.ticket_departments td ON td.id = t.ticket_department_id
     WHERE t.id = NEW.ticket_id;

    UPDATE public.tickets
       SET comm_status = 'awaiting_customer',
           comm_status_since = now(),
           last_agent_reply_at = now(),
           next_customer_reminder_at = now() + make_interval(days => COALESCE(v_reminder_days, 3)),
           updated_at = now()
     WHERE id = NEW.ticket_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tickets_comm_status_on_message ON public.ticket_messages;
CREATE TRIGGER trg_tickets_comm_status_on_message
AFTER INSERT ON public.ticket_messages
FOR EACH ROW EXECUTE FUNCTION public.tickets_update_comm_status_on_message();

-- Trigger to set closed comm_status when ticket status becomes closed
CREATE OR REPLACE FUNCTION public.tickets_sync_comm_status_on_close()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('closed','resolved') AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    NEW.comm_status := 'closed';
    NEW.comm_status_since := now();
    NEW.next_customer_reminder_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tickets_comm_status_on_close ON public.tickets;
CREATE TRIGGER trg_tickets_comm_status_on_close
BEFORE UPDATE OF status ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.tickets_sync_comm_status_on_close();

CREATE INDEX IF NOT EXISTS idx_tickets_comm_status ON public.tickets(comm_status);
CREATE INDEX IF NOT EXISTS idx_tickets_next_reminder ON public.tickets(next_customer_reminder_at) WHERE next_customer_reminder_at IS NOT NULL;
