CREATE OR REPLACE FUNCTION public.trg_dispatch_tour_calendar_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT DISTINCT a.id
    FROM public.delivery_tour_stops s
    JOIN public.delivery_appointments a ON a.id = s.appointment_id
    WHERE s.tour_id = COALESCE(NEW.id, OLD.id)
  LOOP
    PERFORM public.dispatch_sync_appointment_to_calendar(r.id);
  END LOOP;
  RETURN COALESCE(NEW, OLD);
END;
$$;