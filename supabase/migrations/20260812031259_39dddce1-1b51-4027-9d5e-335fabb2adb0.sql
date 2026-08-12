DO $$
DECLARE j text;
BEGIN
  FOREACH j IN ARRAY ARRAY[
    'zoho-invoices-auto-import-1300',
    'zoho-invoices-auto-import-2220',
    'zoho-draft-invoices-daily',
    'daily-recurring-invoice-sync',
    'sync-zoho-to-finance-daily',
    'alix-flex-sync-de',
    'alix-flex-sync-at',
    'zoho-packages-daily'
  ] LOOP
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = j) THEN
      PERFORM cron.unschedule(j);
    END IF;
  END LOOP;
END $$;