CREATE OR REPLACE FUNCTION public.release_on_hold_or_lawyer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.order_status IN ('Anwalt', 'Hold')
     AND (OLD.order_status IS DISTINCT FROM NEW.order_status) THEN
    UPDATE public.lager_devices
       SET reserved_order_id = NULL,
           updated_at = now()
     WHERE reserved_order_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.release_on_hold_or_lawyer() FROM PUBLIC, anon, authenticated;