
CREATE OR REPLACE FUNCTION public.sys_health_autofix()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  actions jsonb := '[]'::jsonb;
  r record;
  n integer := 0;
  del integer := 0;
BEGIN
  FOR r IN
    SELECT relname FROM pg_stat_user_tables
    WHERE schemaname = 'public' AND (n_dead_tup > 1000 OR last_analyze IS NULL)
    ORDER BY n_dead_tup DESC LIMIT 15
  LOOP
    EXECUTE format('ANALYZE public.%I', r.relname);
    n := n + 1;
  END LOOP;
  actions := actions || jsonb_build_object('action', 'analyze_tables', 'count', n);

  DELETE FROM public.sys_health_runs WHERE created_at < now() - interval '180 days';
  GET DIAGNOSTICS del = ROW_COUNT;
  actions := actions || jsonb_build_object('action', 'purge_old_health_runs', 'count', del);

  BEGIN
    PERFORM public.audit_retention_purge();
    actions := actions || jsonb_build_object('action', 'audit_retention_purge', 'ok', true);
  EXCEPTION WHEN OTHERS THEN
    actions := actions || jsonb_build_object('action', 'audit_retention_purge', 'ok', false, 'error', SQLERRM);
  END;

  BEGIN
    PERFORM public.backup_watchdog_mark_stuck();
    actions := actions || jsonb_build_object('action', 'backup_watchdog', 'ok', true);
  EXCEPTION WHEN OTHERS THEN
    actions := actions || jsonb_build_object('action', 'backup_watchdog', 'ok', false, 'error', SQLERRM);
  END;

  RETURN actions;
END;
$$;
REVOKE ALL ON FUNCTION public.sys_health_autofix() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sys_health_autofix() TO service_role;
