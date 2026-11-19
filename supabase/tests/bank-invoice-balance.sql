-- Run as database owner. No real payment, invoice or mail is created.
-- Each assertion tests the production function, not a duplicate implementation.
DO $test$
BEGIN
 IF public.bank_invoice_balance_ceiling(348.33,348.33,348.33) IS DISTINCT FROM 0::numeric THEN RAISE EXCEPTION 'INV-12314: full booked payment must close invoice'; END IF;
 IF public.bank_invoice_balance_ceiling(348.33,348.33,100) IS DISTINCT FROM 248.33::numeric THEN RAISE EXCEPTION 'Partial payment'; END IF;
 IF public.bank_invoice_balance_ceiling(348.33,248.33,100) IS DISTINCT FROM 248.33::numeric THEN RAISE EXCEPTION 'Idempotent reconciliation'; END IF;
 IF public.bank_invoice_balance_ceiling(348.33,0,348.33) IS DISTINCT FROM 0::numeric THEN RAISE EXCEPTION 'Already paid'; END IF;
 IF public.bank_invoice_balance_ceiling(348.33,348.33,0) IS DISTINCT FROM 348.33::numeric THEN RAISE EXCEPTION 'Full reversal'; END IF;
 IF public.bank_invoice_balance_ceiling(348.33,348.33,248.33) IS DISTINCT FROM 100::numeric THEN RAISE EXCEPTION 'Partial reversal'; END IF;
 IF public.bank_invoice_balance_ceiling(348.33,100,100) IS DISTINCT FROM 100::numeric THEN RAISE EXCEPTION 'Do not add remote and local evidence'; END IF;
END;
$test$;