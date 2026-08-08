CREATE OR REPLACE FUNCTION public.next_backup_window()
RETURNS TABLE(schedule_name text, next_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH cand AS (
    SELECT
      s.name AS schedule_name,
      CASE
        WHEN ((current_date + s.time_of_day) AT TIME ZONE 'Europe/Berlin') > now()
          THEN ((current_date + s.time_of_day) AT TIME ZONE 'Europe/Berlin')
        ELSE ((current_date + 1 + s.time_of_day) AT TIME ZONE 'Europe/Berlin')
      END AS next_at
    FROM public.backup_schedules s
    WHERE s.active = true AND s.time_of_day IS NOT NULL
  )
  SELECT schedule_name, next_at FROM cand ORDER BY next_at ASC LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.next_backup_window() TO authenticated;