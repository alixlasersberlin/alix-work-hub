CREATE OR REPLACE FUNCTION public.delivery_sync_ratenstart()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_date date;
BEGIN
  IF NEW.status = 'erfolgreich_ausgeliefert'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    v_date := COALESCE(NEW.delivered_at::date, NEW.planned_date, CURRENT_DATE);

    IF NEW.order_number IS NOT NULL AND length(trim(NEW.order_number)) > 0 THEN
      UPDATE public.zoho_recurring_profiles p
         SET delivery_date = v_date,
             delivery_source = 'dispatch',
             start_date = COALESCE(p.start_date, v_date),
             updated_at = now()
       WHERE trim(p.reference_number) = trim(NEW.order_number)
         AND (p.delivery_date IS NULL OR p.delivery_source IS DISTINCT FROM 'manual');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_delivery_sync_ratenstart ON public.delivery_appointments;
CREATE TRIGGER trg_delivery_sync_ratenstart
AFTER INSERT OR UPDATE OF status ON public.delivery_appointments
FOR EACH ROW EXECUTE FUNCTION public.delivery_sync_ratenstart();