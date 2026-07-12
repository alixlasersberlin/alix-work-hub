
ALTER TABLE public.esc_events
  ADD COLUMN IF NOT EXISTS ticket_id uuid REFERENCES public.tickets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS event_kind text,
  ADD COLUMN IF NOT EXISTS appointment_status text NOT NULL DEFAULT 'geplant';

CREATE INDEX IF NOT EXISTS idx_esc_events_ticket_id ON public.esc_events(ticket_id);
CREATE INDEX IF NOT EXISTS idx_esc_events_event_kind ON public.esc_events(event_kind);
-- Ein Ticket darf pro event_kind maximal einen Kalendereintrag haben
CREATE UNIQUE INDEX IF NOT EXISTS uq_esc_events_ticket_kind
  ON public.esc_events(ticket_id, event_kind)
  WHERE ticket_id IS NOT NULL AND event_kind IS NOT NULL AND deleted_at IS NULL;

-- Reverse-Sync: Kalender → Ticket
CREATE OR REPLACE FUNCTION public.esc_events_sync_to_ticket()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF NEW.ticket_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Start verschoben
  IF NEW.start_at IS DISTINCT FROM OLD.start_at THEN
    IF NEW.event_kind IN ('kundentermin','vor_ort','reparatur','lieferung','schulung') THEN
      UPDATE public.tickets SET appointment_at = NEW.start_at WHERE id = NEW.ticket_id;
    ELSIF NEW.event_kind IN ('frist','rueckruf','eskalation') THEN
      UPDATE public.tickets SET due_at = NEW.start_at WHERE id = NEW.ticket_id;
    ELSIF NEW.event_kind = 'wiedervorlage' THEN
      UPDATE public.tickets SET follow_up_at = NEW.start_at WHERE id = NEW.ticket_id;
    END IF;

    INSERT INTO public.ticket_history(ticket_id, action, field, old_value, new_value, actor_id, meta)
    VALUES (NEW.ticket_id, 'calendar_rescheduled', 'start_at',
            OLD.start_at::text, NEW.start_at::text, v_actor,
            jsonb_build_object('event_id', NEW.id, 'event_kind', NEW.event_kind));
  END IF;

  -- Terminstatus geändert
  IF NEW.appointment_status IS DISTINCT FROM OLD.appointment_status THEN
    INSERT INTO public.ticket_history(ticket_id, action, field, old_value, new_value, actor_id, meta)
    VALUES (NEW.ticket_id, 'appointment_status_changed', 'appointment_status',
            OLD.appointment_status, NEW.appointment_status, v_actor,
            jsonb_build_object('event_id', NEW.id));
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_esc_events_sync_to_ticket ON public.esc_events;
CREATE TRIGGER trg_esc_events_sync_to_ticket
  AFTER UPDATE ON public.esc_events
  FOR EACH ROW
  WHEN (NEW.ticket_id IS NOT NULL)
  EXECUTE FUNCTION public.esc_events_sync_to_ticket();
