UPDATE public.lager_devices
   SET notes = regexp_replace(notes, '\[Status:\s*Ausgeliefert\]', '[Status: Archiviert]'),
       updated_at = now()
 WHERE notes ILIKE '%[Status: Ausgeliefert]%';