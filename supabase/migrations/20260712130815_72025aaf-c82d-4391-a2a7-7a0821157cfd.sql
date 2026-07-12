
-- 1. Extend tickets
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS ticket_department_id uuid REFERENCES public.ticket_departments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS due_at timestamptz,
  ADD COLUMN IF NOT EXISTS appointment_at timestamptz,
  ADD COLUMN IF NOT EXISTS device_id uuid,
  ADD COLUMN IF NOT EXISTS order_id uuid,
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS desired_response text,
  ADD COLUMN IF NOT EXISTS desired_appointment_at timestamptz,
  ADD COLUMN IF NOT EXISTS routing_note text;

CREATE INDEX IF NOT EXISTS idx_tickets_department_id ON public.tickets(ticket_department_id);
CREATE INDEX IF NOT EXISTS idx_tickets_due_at ON public.tickets(due_at);
CREATE INDEX IF NOT EXISTS idx_tickets_appointment_at ON public.tickets(appointment_at);
CREATE INDEX IF NOT EXISTS idx_tickets_source ON public.tickets(source);

-- 2. Ticket history
CREATE TABLE IF NOT EXISTS public.ticket_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  action text NOT NULL,
  field text,
  old_value text,
  new_value text,
  meta jsonb,
  actor_id uuid,
  actor_label text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ticket_history TO authenticated;
GRANT INSERT ON public.ticket_history TO authenticated;
GRANT ALL ON public.ticket_history TO service_role;

ALTER TABLE public.ticket_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ticket_history read authenticated"
  ON public.ticket_history FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "ticket_history insert authenticated"
  ON public.ticket_history FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "ticket_history delete super admin"
  ON public.ticket_history FOR DELETE TO authenticated
  USING (public.has_role('Super Admin'));

CREATE INDEX IF NOT EXISTS idx_ticket_history_ticket_id ON public.ticket_history(ticket_id, created_at DESC);

-- 3. Trigger to log changes
CREATE OR REPLACE FUNCTION public.tickets_log_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.ticket_history(ticket_id, action, field, new_value, actor_id, meta)
    VALUES (NEW.id, 'created', 'status', NEW.status, v_actor,
            jsonb_build_object('source', NEW.source, 'department_id', NEW.ticket_department_id, 'assigned_to', NEW.assigned_to));
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      INSERT INTO public.ticket_history(ticket_id, action, field, old_value, new_value, actor_id)
      VALUES (NEW.id, 'status_changed', 'status', OLD.status, NEW.status, v_actor);
    END IF;
    IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
      INSERT INTO public.ticket_history(ticket_id, action, field, old_value, new_value, actor_id)
      VALUES (NEW.id, 'assignment_changed', 'assigned_to', OLD.assigned_to::text, NEW.assigned_to::text, v_actor);
    END IF;
    IF NEW.ticket_department_id IS DISTINCT FROM OLD.ticket_department_id THEN
      INSERT INTO public.ticket_history(ticket_id, action, field, old_value, new_value, actor_id)
      VALUES (NEW.id, 'department_changed', 'ticket_department_id', OLD.ticket_department_id::text, NEW.ticket_department_id::text, v_actor);
    END IF;
    IF NEW.due_at IS DISTINCT FROM OLD.due_at THEN
      INSERT INTO public.ticket_history(ticket_id, action, field, old_value, new_value, actor_id)
      VALUES (NEW.id, 'due_changed', 'due_at', OLD.due_at::text, NEW.due_at::text, v_actor);
    END IF;
    IF NEW.appointment_at IS DISTINCT FROM OLD.appointment_at THEN
      INSERT INTO public.ticket_history(ticket_id, action, field, old_value, new_value, actor_id)
      VALUES (NEW.id, 'appointment_changed', 'appointment_at', OLD.appointment_at::text, NEW.appointment_at::text, v_actor);
    END IF;
    IF NEW.priority IS DISTINCT FROM OLD.priority THEN
      INSERT INTO public.ticket_history(ticket_id, action, field, old_value, new_value, actor_id)
      VALUES (NEW.id, 'priority_changed', 'priority', OLD.priority, NEW.priority, v_actor);
    END IF;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_tickets_log_changes ON public.tickets;
CREATE TRIGGER trg_tickets_log_changes
  AFTER INSERT OR UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.tickets_log_changes();
