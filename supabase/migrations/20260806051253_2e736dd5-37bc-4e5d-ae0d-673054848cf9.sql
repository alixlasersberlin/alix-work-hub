CREATE OR REPLACE FUNCTION public.dispatch_dashboard_kpis(p_from date, p_to date)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $$
WITH app AS (
  SELECT * FROM public.delivery_appointments
  WHERE planned_date BETWEEN p_from AND p_to
),
tr AS (
  SELECT * FROM public.delivery_tours WHERE tour_date BETWEEN p_from AND p_to
),
st AS (
  SELECT s.* FROM public.delivery_tour_stops s
  JOIN tr ON tr.id = s.tour_id
),
co AS (
  SELECT c.* FROM public.delivery_costs c
  LEFT JOIN public.delivery_tours t ON t.id = c.tour_id
  WHERE (t.tour_date BETWEEN p_from AND p_to)
     OR (c.tour_id IS NULL AND c.created_at::date BETWEEN p_from AND p_to)
)
SELECT jsonb_build_object(
  'appointments_total', (SELECT count(*) FROM app),
  'delivered', (SELECT count(*) FROM app WHERE status IN ('erfolgreich_ausgeliefert','abgeschlossen')),
  'partial', (SELECT count(*) FROM app WHERE status = 'teilweise_ausgeliefert'),
  'failed', (SELECT count(*) FROM app WHERE status IN ('lieferung_fehlgeschlagen','nicht_angetroffen','kunde_abgelehnt')),
  'open', (SELECT count(*) FROM app WHERE status NOT IN ('erfolgreich_ausgeliefert','abgeschlossen','storniert','lieferung_fehlgeschlagen')),
  'awaiting_confirmation', (SELECT count(*) FROM app WHERE status IN ('bestaetigung_versendet','kunde_geoeffnet')),
  'confirmed', (SELECT count(*) FROM app WHERE confirmed_at IS NOT NULL),
  'confirmation_rate', COALESCE(round(100.0 * (SELECT count(*) FROM app WHERE confirmed_at IS NOT NULL)
                        / NULLIF((SELECT count(*) FROM app WHERE status <> 'entwurf'), 0), 1), 0),
  'avg_confirm_hours', COALESCE(round((SELECT avg(EXTRACT(EPOCH FROM (confirmed_at - created_at))/3600) FROM app WHERE confirmed_at IS NOT NULL)::numeric, 1), 0),
  'red', (SELECT count(*) FROM app WHERE readiness = 'rot'),
  'vip', (SELECT count(*) FROM app WHERE is_vip),
  'undated', (SELECT count(*) FROM public.delivery_appointments WHERE planned_date IS NULL AND status NOT IN ('storniert','abgeschlossen')),
  'undated_long', (SELECT count(*) FROM public.delivery_appointments
                    WHERE planned_date IS NULL AND readiness = 'gruen'
                      AND status NOT IN ('storniert','abgeschlossen')
                      AND created_at < now() - interval '14 days'),
  'tours', (SELECT count(*) FROM tr),
  'tours_released', (SELECT count(*) FROM tr WHERE status IN ('freigegeben','aktiv','abgeschlossen','archiviert')),
  'tours_done', (SELECT count(*) FROM tr WHERE status IN ('abgeschlossen','archiviert')),
  'planned_km', COALESCE(round((SELECT sum(planned_distance_km) FROM tr)::numeric, 1), 0),
  'actual_km', COALESCE(round((SELECT sum(actual_distance_km) FROM tr)::numeric, 1), 0),
  'drive_hours', COALESCE(round((SELECT sum(planned_drive_minutes) FROM tr)::numeric / 60, 1), 0),
  'avg_utilization', COALESCE(round((SELECT avg(utilization_pct) FROM tr WHERE utilization_pct IS NOT NULL)::numeric, 1), 0),
  'stops', (SELECT count(*) FROM st),
  'stops_per_tour', COALESCE(round((SELECT count(*) FROM st)::numeric / NULLIF((SELECT count(*) FROM tr), 0), 1), 0),
  'punctuality_pct', COALESCE(round(100.0 * (SELECT count(*) FROM st WHERE actual_arrival IS NOT NULL AND COALESCE(delay_minutes,0) <= 15)
                        / NULLIF((SELECT count(*) FROM st WHERE actual_arrival IS NOT NULL), 0), 1), 0),
  'avg_delay_minutes', COALESCE(round((SELECT avg(COALESCE(delay_minutes,0)) FROM st WHERE actual_arrival IS NOT NULL)::numeric, 1), 0),
  'incidents', (SELECT count(*) FROM public.delivery_incidents i
                 LEFT JOIN public.delivery_tours t2 ON t2.id = i.tour_id
                 WHERE COALESCE(t2.tour_date, i.created_at::date) BETWEEN p_from AND p_to),
  'cost_total', COALESCE(round((SELECT sum(amount) FROM co)::numeric, 2), 0),
  'cost_per_tour', COALESCE(round((SELECT sum(amount) FROM co)::numeric / NULLIF((SELECT count(*) FROM tr), 0), 2), 0),
  'cost_per_delivery', COALESCE(round((SELECT sum(amount) FROM co)::numeric
                        / NULLIF((SELECT count(*) FROM app WHERE status IN ('erfolgreich_ausgeliefert','abgeschlossen')), 0), 2), 0)
)
$$;

GRANT EXECUTE ON FUNCTION public.dispatch_dashboard_kpis(date, date) TO authenticated;

CREATE OR REPLACE FUNCTION public.dispatch_smart_hints(p_from date, p_to date)
RETURNS TABLE(kind text, severity text, title text, detail text, link text)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  -- Leerfahrt-Warnung: Touren mit weniger als 2 Stopps
  SELECT 'leerfahrt', 'warn',
         'Leerfahrt-Risiko: Tour ' || COALESCE(t.tour_number, t.title, ''),
         to_char(t.tour_date,'DD.MM.YYYY') || ' – nur ' || (SELECT count(*) FROM public.delivery_tour_stops s WHERE s.tour_id = t.id) || ' Stopp(s)',
         '/dispatch/touren/' || t.id
  FROM public.delivery_tours t
  WHERE t.tour_date BETWEEN p_from AND p_to
    AND t.status NOT IN ('storniert','archiviert')
    AND (SELECT count(*) FROM public.delivery_tour_stops s WHERE s.tour_id = t.id) < 2

  UNION ALL
  -- Tourzusammenlegung: mehrere Touren am selben Tag mit geringer Auslastung
  SELECT 'zusammenlegen', 'info',
         'Touren zusammenlegen (' || to_char(t.tour_date,'DD.MM.YYYY') || ')',
         count(*) || ' Touren mit unter 50 % Auslastung',
         '/dispatch/tagesplanung?date=' || to_char(t.tour_date,'YYYY-MM-DD')
  FROM public.delivery_tours t
  WHERE t.tour_date BETWEEN p_from AND p_to
    AND COALESCE(t.utilization_pct, 0) < 50
    AND t.status NOT IN ('storniert','archiviert')
  GROUP BY t.tour_date
  HAVING count(*) > 1

  UNION ALL
  -- Fehlende Ressourcen
  SELECT 'ressourcen', 'warn',
         'Tour ohne ' || CASE WHEN t.driver_id IS NULL AND t.vehicle_id IS NULL THEN 'Fahrer und Fahrzeug'
                              WHEN t.driver_id IS NULL THEN 'Fahrer' ELSE 'Fahrzeug' END,
         COALESCE(t.tour_number, t.title, '') || ' · ' || to_char(t.tour_date,'DD.MM.YYYY'),
         '/dispatch/touren/' || t.id
  FROM public.delivery_tours t
  WHERE t.tour_date BETWEEN p_from AND p_to
    AND t.status NOT IN ('storniert','archiviert')
    AND (t.driver_id IS NULL OR t.vehicle_id IS NULL)

  UNION ALL
  -- Arbeitszeitwarnung
  SELECT 'arbeitszeit', 'danger',
         'Arbeitszeit über 10 h: ' || COALESCE(t.tour_number, t.title, ''),
         round(COALESCE(t.planned_work_minutes,0)::numeric/60, 1) || ' h geplant am ' || to_char(t.tour_date,'DD.MM.YYYY'),
         '/dispatch/touren/' || t.id
  FROM public.delivery_tours t
  WHERE t.tour_date BETWEEN p_from AND p_to
    AND COALESCE(t.planned_work_minutes,0) > 600

  UNION ALL
  -- Regionsbündelung: gleiche PLZ-Region am selben Tag, aber ungeplant
  SELECT 'region', 'info',
         'Regionsbündelung PLZ ' || left(a.delivery_zip, 2) || 'xxx',
         count(*) || ' ungeplante lieferbereite Termine in einer Region',
         '/dispatch/ungeplant'
  FROM public.delivery_appointments a
  WHERE a.planned_date IS NULL
    AND a.readiness = 'gruen'
    AND a.delivery_zip IS NOT NULL AND length(a.delivery_zip) >= 2
    AND a.status NOT IN ('storniert','abgeschlossen')
  GROUP BY left(a.delivery_zip, 2)
  HAVING count(*) >= 2

  UNION ALL
  -- Lange ungeplante lieferbereite Aufträge
  SELECT 'ungeplant', 'warn',
         'Seit ' || (now()::date - a.created_at::date) || ' Tagen lieferbereit ohne Termin',
         COALESCE(a.company_name, a.customer_name, '') || ' · ' || COALESCE(a.order_number, ''),
         '/dispatch/ungeplant'
  FROM public.delivery_appointments a
  WHERE a.planned_date IS NULL
    AND a.readiness = 'gruen'
    AND a.status NOT IN ('storniert','abgeschlossen')
    AND a.created_at < now() - interval '14 days'
$$;

GRANT EXECUTE ON FUNCTION public.dispatch_smart_hints(date, date) TO authenticated;