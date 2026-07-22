
CREATE OR REPLACE FUNCTION public.alixdocs2_purge_deleted()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE n INTEGER;
BEGIN
  WITH d AS (
    DELETE FROM public.alixdocs2_documents
    WHERE deleted_at IS NOT NULL AND deleted_at < now() - INTERVAL '30 days'
    RETURNING 1
  ) SELECT count(*) INTO n FROM d;
  RETURN n;
END; $$;

REVOKE EXECUTE ON FUNCTION public.alixdocs2_purge_deleted() FROM PUBLIC, anon, authenticated;

SELECT cron.unschedule('alixdocs2_purge_deleted_daily')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'alixdocs2_purge_deleted_daily');

SELECT cron.schedule(
  'alixdocs2_purge_deleted_daily',
  '45 3 * * *',
  $$ SELECT public.alixdocs2_purge_deleted(); $$
);
