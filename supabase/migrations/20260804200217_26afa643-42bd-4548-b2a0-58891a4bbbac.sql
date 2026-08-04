CREATE OR REPLACE FUNCTION public.housekeeping_purge_logs()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _t record;
  _n bigint;
  _out jsonb := '{}'::jsonb;
BEGIN
  FOR _t IN
    SELECT * FROM (VALUES
      ('ac_analytics_events','created_at',180),
      ('alixsmart_events','created_at',180),
      ('alixsmart_sync_runs','created_at',180),
      ('alixsmart_webhook_deliveries','created_at',180),
      ('ai_service_logs','created_at',180),
      ('alix_security_events','created_at',365),
      ('mail_audit_logs','created_at',365)
    ) AS v(tbl, col, days)
  LOOP
    IF to_regclass('public.' || _t.tbl) IS NULL THEN CONTINUE; END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name=_t.tbl AND column_name=_t.col
    ) THEN CONTINUE; END IF;

    EXECUTE format('DELETE FROM public.%I WHERE %I < now() - make_interval(days => %s)',
                   _t.tbl, _t.col, _t.days);
    GET DIAGNOSTICS _n = ROW_COUNT;
    _out := _out || jsonb_build_object(_t.tbl, _n);
  END LOOP;

  RETURN _out;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.housekeeping_purge_logs() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.housekeeping_purge_logs() TO service_role;

SELECT cron.unschedule('housekeeping-purge-logs')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'housekeeping-purge-logs');

SELECT cron.schedule('housekeeping-purge-logs', '30 3 * * 0',
  $$SELECT public.housekeeping_purge_logs();$$);