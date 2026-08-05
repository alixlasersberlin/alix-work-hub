
-- =============== Tables ===============
CREATE TABLE public.sys_health_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  score integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'running',
  trigger text NOT NULL DEFAULT 'cron',
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  auto_actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sys_health_runs TO authenticated;
GRANT ALL ON public.sys_health_runs TO service_role;
ALTER TABLE public.sys_health_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sys_health_runs_super_admin_read" ON public.sys_health_runs
  FOR SELECT TO authenticated USING (public.has_role('Super Admin'));

CREATE TABLE public.sys_health_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.sys_health_runs(id) ON DELETE CASCADE,
  category text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  title text NOT NULL,
  detail text,
  recommendation text,
  target text,
  metric numeric,
  auto_fixed boolean NOT NULL DEFAULT false,
  needs_approval boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.sys_health_findings TO authenticated;
GRANT ALL ON public.sys_health_findings TO service_role;
ALTER TABLE public.sys_health_findings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sys_health_findings_super_admin_read" ON public.sys_health_findings
  FOR SELECT TO authenticated USING (public.has_role('Super Admin'));
CREATE POLICY "sys_health_findings_super_admin_update" ON public.sys_health_findings
  FOR UPDATE TO authenticated USING (public.has_role('Super Admin'))
  WITH CHECK (public.has_role('Super Admin'));
CREATE INDEX idx_sys_health_findings_run ON public.sys_health_findings(run_id, severity);

CREATE TABLE public.sys_health_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finding_id uuid REFERENCES public.sys_health_findings(id) ON DELETE SET NULL,
  action_type text NOT NULL,
  title text NOT NULL,
  description text,
  sql_preview text,
  risk text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'pending',
  decided_by uuid,
  decided_at timestamptz,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.sys_health_approvals TO authenticated;
GRANT ALL ON public.sys_health_approvals TO service_role;
ALTER TABLE public.sys_health_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sys_health_approvals_super_admin_all" ON public.sys_health_approvals
  FOR ALL TO authenticated USING (public.has_role('Super Admin'))
  WITH CHECK (public.has_role('Super Admin'));
CREATE INDEX idx_sys_health_approvals_status ON public.sys_health_approvals(status, created_at DESC);

CREATE TRIGGER trg_sys_health_runs_updated BEFORE UPDATE ON public.sys_health_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_sys_health_findings_updated BEFORE UPDATE ON public.sys_health_findings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_sys_health_approvals_updated BEFORE UPDATE ON public.sys_health_approvals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============== Diagnostics ===============
CREATE OR REPLACE FUNCTION public.sys_health_metrics()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v jsonb;
BEGIN
  SELECT jsonb_build_object(
    'db_size_bytes', (SELECT pg_database_size(current_database())),
    'cache_hit_ratio', (
      SELECT COALESCE(round((sum(heap_blks_hit) / NULLIF(sum(heap_blks_hit) + sum(heap_blks_read), 0))::numeric, 4), 1)
      FROM pg_statio_user_tables
    ),
    'index_hit_ratio', (
      SELECT COALESCE(round((sum(idx_blks_hit) / NULLIF(sum(idx_blks_hit) + sum(idx_blks_read), 0))::numeric, 4), 1)
      FROM pg_statio_user_indexes
    ),
    'connections', (SELECT count(*) FROM pg_stat_activity),
    'connections_active', (SELECT count(*) FROM pg_stat_activity WHERE state = 'active'),
    'connections_max', (SELECT setting::int FROM pg_settings WHERE name = 'max_connections'),
    'long_running', (
      SELECT count(*) FROM pg_stat_activity
      WHERE state = 'active' AND query_start < now() - interval '60 seconds'
        AND backend_type = 'client backend'
    ),
    'blocked', (SELECT count(*) FROM pg_stat_activity WHERE wait_event_type = 'Lock'),
    'deadlocks', (SELECT COALESCE(sum(deadlocks), 0) FROM pg_stat_database WHERE datname = current_database()),
    'tables_total', (SELECT count(*) FROM pg_stat_user_tables),
    'dead_tuples', (SELECT COALESCE(sum(n_dead_tup), 0) FROM pg_stat_user_tables),
    'seq_scan_heavy', (
      SELECT COALESCE(jsonb_agg(x), '[]'::jsonb) FROM (
        SELECT relname AS table_name, seq_scan, idx_scan, n_live_tup,
               pg_total_relation_size(relid) AS total_bytes
        FROM pg_stat_user_tables
        WHERE n_live_tup > 5000 AND seq_scan > COALESCE(idx_scan, 0)
        ORDER BY seq_scan DESC LIMIT 10
      ) x
    ),
    'largest_tables', (
      SELECT COALESCE(jsonb_agg(x), '[]'::jsonb) FROM (
        SELECT relname AS table_name, n_live_tup, n_dead_tup,
               pg_total_relation_size(relid) AS total_bytes
        FROM pg_stat_user_tables ORDER BY pg_total_relation_size(relid) DESC LIMIT 10
      ) x
    ),
    'unused_indexes', (
      SELECT COALESCE(jsonb_agg(x), '[]'::jsonb) FROM (
        SELECT relname AS table_name, indexrelname AS index_name, idx_scan,
               pg_relation_size(indexrelid) AS index_bytes
        FROM pg_stat_user_indexes
        WHERE idx_scan < 20 AND pg_relation_size(indexrelid) > 1024 * 1024
        ORDER BY pg_relation_size(indexrelid) DESC LIMIT 10
      ) x
    ),
    'rls_missing', (
      SELECT COALESCE(jsonb_agg(c.relname), '[]'::jsonb)
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity = false
    ),
    'generated_at', now()
  ) INTO v;
  RETURN v;
END;
$$;
REVOKE ALL ON FUNCTION public.sys_health_metrics() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sys_health_metrics() TO service_role;

-- Risikoarme Wartung: Statistiken aktualisieren, alte Prüfdaten löschen, hängende Backups markieren
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
    WHERE n_dead_tup > 1000 OR last_analyze IS NULL
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
