UPDATE public.gobd_responsibilities
SET notes = notes || ' | Kontaktdaten vollstaendig: E-Mail Ronny D. Eitner (rde@alix-operation.de) am 2026-09-16 durch die Gesamtverantwortung bestaetigt. Diese Bestaetigung ist keine inhaltliche Freigabe des Bereichs.',
    updated_at = now()
WHERE status = 'offen';