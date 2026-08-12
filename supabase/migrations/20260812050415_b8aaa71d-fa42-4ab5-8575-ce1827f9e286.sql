CREATE OR REPLACE FUNCTION public.sys_health_metrics()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v jsonb;
BEGIN
  SELECT jsonb_build_object(
    'db_size_bytes', (SELECT pg_database_size(current_database())),
    'cache_hit_ratio', (
      SELECT COALESCE(round((sum(heap_blks_hit) / NULLIF(sum(heap_blks_hit) + sum(heap_blks_read), 0))::numeric, 4), 1)
      FROM pg_statio_user_tables WHERE schemaname = 'public'
    ),
    'index_hit_ratio', (
      SELECT COALESCE(round((sum(idx_blks_hit) / NULLIF(sum(idx_blks_hit) + sum(idx_blks_read), 0))::numeric, 4), 1)
      FROM pg_statio_user_indexes WHERE schemaname = 'public'
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
    'tables_total', (SELECT count(*) FROM pg_stat_user_tables WHERE schemaname = 'public'),
    'dead_tuples', (SELECT COALESCE(sum(n_dead_tup), 0) FROM pg_stat_user_tables WHERE schemaname = 'public'),
    'seq_scan_heavy', (
      SELECT COALESCE(jsonb_agg(x), '[]'::jsonb) FROM (
        SELECT relname AS table_name, seq_scan, idx_scan, n_live_tup,
               pg_total_relation_size(relid) AS total_bytes
        FROM pg_stat_user_tables
        WHERE schemaname = 'public'
          AND n_live_tup > 20000
          AND seq_scan > 100
          AND seq_scan > COALESCE(idx_scan, 0) * 2
        ORDER BY seq_scan DESC LIMIT 10
      ) x
    ),
    'largest_tables', (
      SELECT COALESCE(jsonb_agg(x), '[]'::jsonb) FROM (
        SELECT relname AS table_name, n_live_tup, n_dead_tup,
               pg_total_relation_size(relid) AS total_bytes
        FROM pg_stat_user_tables WHERE schemaname = 'public'
        ORDER BY pg_total_relation_size(relid) DESC LIMIT 10
      ) x
    ),
    'unused_indexes', (
      SELECT COALESCE(jsonb_agg(x), '[]'::jsonb) FROM (
        SELECT s.relname AS table_name, s.indexrelname AS index_name, s.idx_scan,
               pg_relation_size(s.indexrelid) AS index_bytes
        FROM pg_stat_user_indexes s
        JOIN pg_index i ON i.indexrelid = s.indexrelid
        WHERE s.schemaname = 'public'
          AND s.idx_scan = 0
          AND NOT i.indisprimary AND NOT i.indisunique
          AND pg_relation_size(s.indexrelid) > 20 * 1024 * 1024
        ORDER BY pg_relation_size(s.indexrelid) DESC LIMIT 10
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
$function$;