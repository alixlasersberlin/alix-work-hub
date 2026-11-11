DO $$ DECLARE test_order uuid:=gen_random_uuid(); customer uuid; result jsonb; second_result jsonb; snapshot jsonb; BEGIN
BEGIN
PERFORM set_config('request.jwt.claims','{"role":"service_role"}',true);
SELECT id INTO customer FROM public.customers WHERE source_system='shopify:0213c2-4.myshopify.com' LIMIT 1;
IF customer IS NULL THEN RAISE EXCEPTION 'Test customer unavailable'; END IF;
snapshot:=jsonb_build_object('recipient','fixture@example.invalid','total',119,'net',100,'tax',19,'balance',0,'paid',119,'currency','EUR','tax_included',true,'tax_lines',jsonb_build_array(jsonb_build_object('title','USt.','rate',0.19,'amount',19)),'items',jsonb_build_array(jsonb_build_object('name','TEST ONLY','quantity',1,'amount',119)));
INSERT INTO public.orders(id,customer_id,source_system,external_order_id,order_number,total_amount,currency,order_status,raw_data) VALUES(test_order,customer,'shopify:0213c2-4.myshopify.com','gid://shopify/Order/999999999999999','SHOPIFY TEST ROLLBACK',119,'EUR','offen',jsonb_build_object('shopify',jsonb_build_object('email','fixture@example.invalid','customer_name','TEST ONLY','total',119,'refunded',0)));
result:=public.shopify_invoice_claim(test_order,snapshot);
IF result->>'number' IS NULL OR result->>'invoice_id' IS NULL THEN RAISE EXCEPTION 'Invoice creation/number assertion failed'; END IF;
second_result:=public.shopify_invoice_claim(test_order,snapshot);
IF second_result IS NOT NULL THEN RAISE EXCEPTION 'Parallel claim assertion failed'; END IF;
IF NOT public.shopify_invoice_transition(test_order,(result->>'claim')::uuid,'sending','{}') THEN RAISE EXCEPTION 'Sending transition assertion failed'; END IF;
IF public.shopify_invoice_claim(test_order,snapshot) IS NOT NULL THEN RAISE EXCEPTION 'Duplicate sending assertion failed'; END IF;
IF (SELECT count(*) FROM public.zoho_invoices WHERE raw_data->>'order_id'=test_order::text)<>1 THEN RAISE EXCEPTION 'Unique invoice assertion failed'; END IF;
RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='ROLLBACK_SUCCESS';
EXCEPTION WHEN SQLSTATE 'P0002' THEN NULL;
END;
IF EXISTS(SELECT 1 FROM public.orders WHERE id=test_order) THEN RAISE EXCEPTION 'Rollback assertion failed'; END IF;
END $$;