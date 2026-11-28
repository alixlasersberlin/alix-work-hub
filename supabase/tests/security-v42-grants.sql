-- Read-only regression: division by zero fails if any direct public/staff grant returns.
SELECT p.oid::regprocedure::text AS function_signature,
  1 / CASE WHEN
    NOT has_function_privilege('anon', p.oid, 'EXECUTE')
    AND NOT has_function_privilege('authenticated', p.oid, 'EXECUTE')
    AND has_function_privilege('service_role', p.oid, 'EXECUTE')
  THEN 1 ELSE 0 END AS service_only_assertion
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.oid IN ('public.alixsmart_emit(text,jsonb)'::regprocedure,
                'public.backup_watchdog_mark_stuck()'::regprocedure);