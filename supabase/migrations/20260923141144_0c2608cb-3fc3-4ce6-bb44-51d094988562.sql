-- 1) Platzhalter-Seriennummern auf die echten Nummern korrigieren
UPDATE public.lager_devices
SET serial_number = '2607222017801B6',
    notes = coalesce(notes,'') || ' | Seriennummer korrigiert von SO-3795 am 2026-09-23',
    updated_at = now()
WHERE serial_number = 'SO-3795'
  AND reserved_order_id = '56566ac6-1ea8-43f1-b8b6-936d0877d1ad';

UPDATE public.lager_devices
SET serial_number = '2607222017800B6',
    notes = coalesce(notes,'') || ' | Seriennummer korrigiert von 20260527_10 am 2026-09-23',
    updated_at = now()
WHERE serial_number = '20260527_10'
  AND reserved_order_id = 'ca85ef64-55f0-4d01-9d40-de336928a278';

UPDATE public.lager_devices
SET serial_number = '2607222017802B1',
    notes = coalesce(notes,'') || ' | Seriennummer korrigiert von PLZ891260516006 am 2026-09-23',
    updated_at = now()
WHERE serial_number = 'PLZ891260516006'
  AND reserved_order_id = 'ba0b0c19-8dd3-4d60-bac2-7e91370a440f';

UPDATE public.lager_devices
SET serial_number = '2607222017800B1',
    model_name = 'Alix BlueIce 4W KI Smart White/Gold',
    notes = coalesce(notes,'') || ' | Seriennummer korrigiert von 2606222017800B5 am 2026-09-23',
    updated_at = now()
WHERE serial_number = '2606222017800B5'
  AND reserved_order_id = '1144c489-9f0d-4df3-9301-d2a1ff88607e';

-- 2) Neue Geraete erfassen und den Auftraegen zuordnen
INSERT INTO public.lager_devices (serial_number, model_name, notes, reserved_order_id)
VALUES
  ('2606222017800B2', 'Alix BlueIce 4W KI Smart Black/Gold', '[Typ: Neugerät] [Status: Transfer] SO-4220 Düvel', '7e74da49-5fd1-4180-b550-375281040be9'),
  ('2606222017800B6', 'Alix BlueIce 4W KI Smart Black/Gold', '[Typ: Neugerät] [Status: Transfer] AB-2026-04225 El Jerbi', 'b98c8fd0-7b28-42aa-a736-9725074c6c3a'),
  ('2606222017805B2', 'Alix BlueIce 4W KI Smart White/Silver', '[Typ: Neugerät] [Status: Transfer] AB-2026-00071 Polat', 'eb62d3ff-383e-48a7-bc22-989696a47d0b'),
  ('2606222017801B1', 'Alix BlueIce 4W KI Smart Blue/Gold', '[Typ: Neugerät] [Status: Transfer] ohne Auftrag', NULL);