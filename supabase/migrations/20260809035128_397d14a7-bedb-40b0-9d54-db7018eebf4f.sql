
DROP TRIGGER IF EXISTS delivery_appointments_calendar_sync ON public.delivery_appointments;
CREATE TRIGGER delivery_appointments_calendar_sync
AFTER INSERT OR UPDATE OR DELETE ON public.delivery_appointments
FOR EACH ROW EXECUTE FUNCTION public.trg_dispatch_calendar_sync();

CREATE OR REPLACE FUNCTION public.trg_dispatch_tour_calendar_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.delivery_appointments WHERE tour_id = COALESCE(NEW.id, OLD.id) LOOP
    PERFORM public.dispatch_sync_appointment_to_calendar(r.id);
  END LOOP;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS delivery_tours_calendar_sync ON public.delivery_tours;
CREATE TRIGGER delivery_tours_calendar_sync
AFTER INSERT OR UPDATE OR DELETE ON public.delivery_tours
FOR EACH ROW EXECUTE FUNCTION public.trg_dispatch_tour_calendar_sync();
