REVOKE EXECUTE ON FUNCTION public.perf_slow_queries(int) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.perf_table_stats(int) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.perf_unused_indexes(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.perf_slow_queries(int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.perf_table_stats(int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.perf_unused_indexes(int) TO authenticated;