UPDATE public.delivery_appointments
SET delivery_lat = NULL, delivery_lng = NULL
WHERE (delivery_lat IS NOT NULL OR delivery_lng IS NOT NULL)
  AND (
    COALESCE(NULLIF(TRIM(delivery_street), ''), NULL) IS NULL
    OR (COALESCE(NULLIF(TRIM(delivery_zip), ''), NULL) IS NULL AND COALESCE(NULLIF(TRIM(delivery_city), ''), NULL) IS NULL)
  );

UPDATE public.delivery_tour_stops s
SET distance_from_prev_km = NULL, drive_minutes_from_prev = NULL, planned_arrival = NULL, planned_departure = NULL
FROM public.delivery_appointments a
WHERE a.id = s.appointment_id AND a.delivery_lat IS NULL;