DO $migration$
DECLARE v_definition text;
BEGIN
 SELECT pg_get_functiondef('public.collect_sync_customer(text)'::regprocedure) INTO v_definition;
 v_definition := replace(v_definition, 'CREATE TEMP TABLE _inv_one ON COMMIT DROP AS', 'DROP TABLE IF EXISTS pg_temp._inv_one; CREATE TEMP TABLE _inv_one ON COMMIT DROP AS');
 EXECUTE v_definition;
END;
$migration$;

DO $test$
DECLARE v_balance numeric; v_date date;
BEGIN
 BEGIN
   UPDATE public.zoho_recurring_invoices SET balance=348.33,status='overdue',payment_status='unpaid',last_payment_date=NULL WHERE id='3935e6f1-ee36-4d2c-8bc1-dd93e42b500e';
   SELECT balance,last_payment_date INTO v_balance,v_date FROM public.zoho_recurring_invoices WHERE id='3935e6f1-ee36-4d2c-8bc1-dd93e42b500e';
   IF v_balance IS DISTINCT FROM 0::numeric OR v_date IS DISTINCT FROM DATE '2026-11-02' THEN RAISE EXCEPTION 'INV-12314 sync regression: %, %',v_balance,v_date; END IF;
   UPDATE public.zoho_recurring_invoices SET balance=348.33,status='overdue' WHERE id='3935e6f1-ee36-4d2c-8bc1-dd93e42b500e';
   SELECT balance INTO v_balance FROM public.zoho_recurring_invoices WHERE id='3935e6f1-ee36-4d2c-8bc1-dd93e42b500e';
   IF v_balance IS DISTINCT FROM 0::numeric THEN RAISE EXCEPTION 'Repeated sync reopened paid invoice'; END IF;
   RAISE EXCEPTION USING ERRCODE='ZX001',MESSAGE='Rollback successful regression test';
 EXCEPTION WHEN SQLSTATE 'ZX001' THEN NULL;
 END;
END;
$test$;

DO $refresh$
DECLARE v_key text;
BEGIN
 FOR v_key IN SELECT DISTINCT coalesce(nullif(i.customer_id,''),i.customer_name) FROM public.zoho_recurring_invoices i JOIN public.audit_logs a ON a.record_id=i.id::text AND a.action='BANK_PAYMENT_BALANCE_RECONCILED' LOOP
   DROP TABLE IF EXISTS pg_temp._inv_one;
   PERFORM public.collect_sync_customer(v_key);
 END LOOP;
 DROP TABLE IF EXISTS pg_temp._inv_one;
END;
$refresh$;