UPDATE public.lager_devices ld
SET reserved_order_id = NULL,
    reservation_week = NULL,
    updated_at = now()
WHERE reserved_order_id IN (
  SELECT order_id
  FROM public.order_notes
  WHERE note_type = 'frei_bestellung_hidden'
);