DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname='public'
      AND tablename IN (
        'finance_accounts','finance_contracts','finance_reminders','finance_reminder_items',
        'finance_history','finance_bank_statements','finance_sepa_mandates','finance_bank_lines',
        'finance_bank_postings','finance_cashbook','finance_cashbook_closures','finance_deposits',
        'finance_deposit_bookings','finance_deposit_history','finance_deposit_notifications'
      )
      AND 'public' = ANY(roles)
  LOOP
    EXECUTE format('ALTER POLICY %I ON public.%I TO authenticated', r.policyname, r.tablename);
  END LOOP;
END $$;