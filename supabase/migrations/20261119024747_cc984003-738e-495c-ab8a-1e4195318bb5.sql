DO $test$
DECLARE c jsonb; r jsonb; blocked boolean:=false; n bigint; after_n bigint;
BEGIN
 PERFORM set_config('request.jwt.claim.sub','587ff294-b34a-4c45-a8c0-a14a04ba3a8a',true);
 PERFORM set_config('request.jwt.claims','{"sub":"587ff294-b34a-4c45-a8c0-a14a04ba3a8a","role":"authenticated"}',true);
 SET LOCAL ROLE authenticated;
 SELECT count(*) INTO n FROM public.bank_transaction_allocations;
 BEGIN
 UPDATE public.bank_transactions b SET tenant_id=i.tenant_id FROM public.bank_transaction_allocations a JOIN public.zoho_recurring_invoices i ON i.id::text=a.invoice_id WHERE b.id=a.bank_transaction_id AND i.id='3935e6f1-ee36-4d2c-8bc1-dd93e42b500e';
 SELECT jsonb_build_object('transaction_id',a.bank_transaction_id,'invoice_id',a.invoice_id,'category','paid_target') INTO c FROM public.bank_transaction_allocations a JOIN public.bank_transactions b ON b.id=a.bank_transaction_id WHERE a.invoice_id='3935e6f1-ee36-4d2c-8bc1-dd93e42b500e' AND b.status='verbucht' LIMIT 1;
 r:=public.revision_settle_case(c);
 IF r->>'settled'<>'true' OR (r->>'balance')::numeric<>0 THEN RAISE EXCEPTION 'INV-12314 evidence reconciliation failed'; END IF;
 r:=public.revision_settle_case(c);
 IF (r->>'balance')::numeric<>0 THEN RAISE EXCEPTION 'Repeated reconciliation changed balance'; END IF;
 SELECT value INTO c FROM jsonb_array_elements(public.revision_cases()) WHERE value->>'category'='unbooked' LIMIT 1;
 IF c IS NULL THEN RAISE EXCEPTION 'Expected unpaid real case'; END IF;
 BEGIN PERFORM public.revision_review(c->>'case_key','reviewed','Prüfung ohne Zahlungsnachweis'); EXCEPTION WHEN OTHERS THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Unproven completion accepted'; END IF;
 SELECT count(*) INTO after_n FROM public.bank_transaction_allocations;
 IF after_n<>n THEN RAISE EXCEPTION 'New payment created'; END IF;
 RAISE EXCEPTION USING ERRCODE='ZX001',MESSAGE='Rollback successful tests';
 EXCEPTION WHEN SQLSTATE 'ZX001' THEN NULL;
 END;
 RESET ROLE;
END $test$;