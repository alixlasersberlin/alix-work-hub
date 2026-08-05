
CREATE OR REPLACE FUNCTION public.sys_cron_recent_failures()
RETURNS TABLE(jobname text, status text, return_message text, end_time timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, cron, pg_catalog
AS $$
BEGIN
  RETURN QUERY
  SELECT j.jobname::text, d.status::text, d.return_message::text, d.end_time
  FROM cron.job_run_details d
  JOIN cron.job j ON j.jobid = d.jobid
  WHERE d.status <> 'succeeded'
    AND d.end_time > now() - interval '24 hours'
  ORDER BY d.end_time DESC
  LIMIT 50;
EXCEPTION WHEN OTHERS THEN
  RETURN;
END;
$$;
REVOKE ALL ON FUNCTION public.sys_cron_recent_failures() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sys_cron_recent_failures() TO service_role;
