DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'orders','order_items','route_plans','finance_records','customers',
    'lager_devices','production_orders','login_sessions','audit_logs',
    'finance_accounts','finance_contracts','finance_transactions',
    'mail_messages','repair_orders'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    EXCEPTION WHEN duplicate_object THEN
      NULL; -- Tabelle bereits Teil der Publication
    WHEN undefined_table THEN
      NULL;
    END;
    BEGIN
      EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
    EXCEPTION WHEN undefined_table THEN
      NULL;
    END;
  END LOOP;
END $$;