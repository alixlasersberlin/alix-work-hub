CREATE OR REPLACE FUNCTION public.resolve_frei_bestellung_assignment(_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role('Super Admin') THEN
    RAISE EXCEPTION 'Nur Super Admin darf Zuordnungen löschen.' USING ERRCODE = '42501';
  END IF;

  UPDATE public.lager_devices
     SET reserved_order_id = NULL,
         reservation_week = NULL,
         updated_at = now()
   WHERE reserved_order_id = _order_id;

  INSERT INTO public.order_notes (order_id, note_type, note_text, is_internal, created_by)
  SELECT _order_id,
         'frei_bestellung_hidden',
         'Zuordnung gelöscht — aus „Bestellung möglich" entfernt.',
         true,
         auth.uid()
  WHERE NOT EXISTS (
    SELECT 1
      FROM public.order_notes
     WHERE order_id = _order_id
       AND note_type = 'frei_bestellung_hidden'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_frei_bestellung_assignment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_frei_bestellung_assignment(uuid) TO authenticated;