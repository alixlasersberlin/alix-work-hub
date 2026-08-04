CREATE OR REPLACE FUNCTION public.audit_retention_purge()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cutoff timestamptz := now() - interval '24 months';
  v_logs_cutoff timestamptz := now() - interval '12 months';
  v_a bigint; v_c bigint; v_s bigint; v_l bigint; v_g bigint;
BEGIN
  DELETE FROM public.audit_actions WHERE ts < v_cutoff;
  GET DIAGNOSTICS v_a = ROW_COUNT;
  DELETE FROM public.audit_changes WHERE ts < v_cutoff;
  GET DIAGNOSTICS v_c = ROW_COUNT;
  DELETE FROM public.audit_access_log WHERE ts < v_cutoff;
  GET DIAGNOSTICS v_l = ROW_COUNT;
  DELETE FROM public.audit_sessions WHERE started_at < v_cutoff;
  GET DIAGNOSTICS v_s = ROW_COUNT;
  DELETE FROM public.audit_logs WHERE created_at < v_logs_cutoff;
  GET DIAGNOSTICS v_g = ROW_COUNT;
  RETURN jsonb_build_object(
    'cutoff', v_cutoff,
    'logs_cutoff', v_logs_cutoff,
    'actions_deleted', v_a,
    'changes_deleted', v_c,
    'access_deleted', v_l,
    'sessions_deleted', v_s,
    'audit_logs_deleted', v_g
  );
END $function$;

SELECT cron.schedule('audit-logs-vacuum-full-weekly', '15 4 * * 0', 'VACUUM (FULL, ANALYZE) public.audit_logs');
SELECT cron.schedule('audit-logs-vacuum-full-once', '15 1 * * *', 'VACUUM (FULL, ANALYZE) public.audit_logs');