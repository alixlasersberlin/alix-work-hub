UPDATE public.lager_devices
SET notes = regexp_replace(coalesce(notes,''), '\[Status:\s*[^\]]*\]', '[Status: Bestand]', 'g'),
    device_status = 'Bestand',
    updated_at = now()
WHERE serial_number IN (
  '2606222017800B2','2606222017800B6','2606222017801B1','2606222017805B2',
  '2607222017800B1','2607222017802B1','2607222017800B6','2607222017801B6'
);

UPDATE public.lager_devices
SET notes = coalesce(notes,'') || ' [Status: Bestand]'
WHERE serial_number IN (
  '2606222017800B2','2606222017800B6','2606222017801B1','2606222017805B2',
  '2607222017800B1','2607222017802B1','2607222017800B6','2607222017801B6'
)
AND coalesce(notes,'') NOT LIKE '%[Status:%';