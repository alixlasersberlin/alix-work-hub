CREATE UNIQUE INDEX IF NOT EXISTS shopify_order_identity ON public.orders(source_system,external_order_id) WHERE source_system='shopify:0213c2-4.myshopify.com';
CREATE OR REPLACE FUNCTION public.shopify_apply_order(p_order jsonb, p_dry boolean DEFAULT true, p_update boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_source text:='shopify:0213c2-4.myshopify.com'; v_id uuid; v_customer uuid; v_tenant uuid; v_old jsonb; v_line jsonb; v_result text; v_key text; v_current jsonb;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'service only'; END IF;
 IF p_order->>'external_id' !~ '^gid://shopify/Order/[0-9]+$' OR jsonb_typeof(p_order->'items') IS DISTINCT FROM 'array' OR jsonb_array_length(p_order->'items')=0 OR (p_order->>'total')::numeric < 0 THEN RAISE EXCEPTION 'Invalid order'; END IF;
 SELECT id INTO v_tenant FROM tenants WHERE code='DE' AND is_active=true;
 IF v_tenant IS NULL THEN RAISE EXCEPTION 'Tenant unavailable'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(v_source||':'||(p_order->>'external_id'),0));
 SELECT id,raw_data->'shopify' INTO v_id,v_old FROM orders WHERE source_system=v_source AND external_order_id=p_order->>'external_id' FOR UPDATE;
 IF p_dry THEN RETURN jsonb_build_object('status',CASE WHEN v_id IS NULL THEN 'ready' ELSE 'skipped' END,'order_id',v_id); END IF;
 IF NOT EXISTS(SELECT 1 FROM integration_health WHERE integration='shopify-orders' AND tenant_id=v_tenant AND shop_config->>'production_enabled'='true') THEN RAISE EXCEPTION 'Production import not approved'; END IF;
 IF v_id IS NOT NULL AND NOT p_update THEN RETURN jsonb_build_object('status','skipped','order_id',v_id); END IF;
 IF v_id IS NOT NULL THEN
  IF v_old IS NULL THEN RAISE EXCEPTION 'Existing order is not import-owned'; END IF;
  IF (v_old->>'updated_at')::timestamptz >= (p_order->>'updated_at')::timestamptz THEN RETURN jsonb_build_object('status','skipped','order_id',v_id); END IF;
  SELECT jsonb_build_object('total',total_amount,'shipping',shipping_address,'billing',billing_address,'status',order_status) INTO v_current FROM orders WHERE id=v_id;
  IF v_current IS DISTINCT FROM jsonb_build_object('total',(v_old->>'total')::numeric,'shipping',v_old->'shipping','billing',v_old->'billing','status',v_old->>'status') THEN RAISE EXCEPTION 'Local order changes require manual review'; END IF;
  UPDATE orders SET total_amount=(p_order->>'total')::numeric,shipping_address=p_order->'shipping',billing_address=p_order->'billing',order_status=p_order->>'status',finance_payment_status=p_order->>'payment_status',finance_paid_amount=(p_order->>'paid')::numeric,finance_open_amount=(p_order->>'outstanding')::numeric,raw_data=jsonb_set(coalesce(raw_data,'{}'),'{shopify}',p_order),updated_at=now() WHERE id=v_id AND source_system=v_source;
  v_result:='updated';
 ELSE
  v_key:=coalesce(nullif(p_order->>'customer_id',''), 'guest:'||(p_order->>'external_id'));
  PERFORM pg_advisory_xact_lock(hashtextextended(v_source||':customer:'||v_key,0));
  SELECT id INTO v_customer FROM customers WHERE source_system=v_source AND external_customer_id=v_key;
  IF v_customer IS NULL THEN
   INSERT INTO customers(external_customer_id,source_system,contact_name,company_name,email,phone,billing_address,shipping_address,contact_tenant_id,raw_data) VALUES(v_key,v_source,p_order->>'customer_name',p_order->>'company',p_order->>'email',p_order->>'phone',p_order->'billing',p_order->'shipping',v_tenant,jsonb_build_object('shopify_customer_id',p_order->>'customer_id')) RETURNING id INTO v_customer;
  END IF;
  INSERT INTO orders(customer_id,external_order_id,order_number,source_system,order_status,currency,total_amount,order_date,billing_address,shipping_address,finance_payment_status,finance_paid_amount,finance_open_amount,raw_data) VALUES(v_customer,p_order->>'external_id','SHOPIFY '||(p_order->>'name'),v_source,p_order->>'status',p_order->>'currency',(p_order->>'total')::numeric,(p_order->>'created_at')::timestamptz,p_order->'billing',p_order->'shipping',p_order->>'payment_status',(p_order->>'paid')::numeric,(p_order->>'outstanding')::numeric,jsonb_build_object('shopify',p_order)) RETURNING id INTO v_id;
  v_result:='imported';
 END IF;
 -- Import-owned positions only; keep original line objects as an audit snapshot. Never delete positions.
 IF v_result='updated' AND EXISTS(SELECT 1 FROM order_items i WHERE i.order_id=v_id AND (i.raw_data->>'shopify_owned' IS DISTINCT FROM 'true' OR i.quantity IS DISTINCT FROM (i.raw_data->>'quantity')::numeric OR i.rate IS DISTINCT FROM (i.raw_data->>'rate')::numeric OR i.amount IS DISTINCT FROM (i.raw_data->>'amount')::numeric OR i.item_name IS DISTINCT FROM i.raw_data->>'name')) THEN RAISE EXCEPTION 'Local item changes require manual review'; END IF;
 FOR v_line IN SELECT value FROM jsonb_array_elements(p_order->'items') LOOP
  IF EXISTS(SELECT 1 FROM order_items WHERE order_id=v_id AND external_item_id=v_line->>'id') THEN
   UPDATE order_items SET item_name=v_line->>'name',sku=v_line->>'sku',quantity=(v_line->>'quantity')::numeric,rate=(v_line->>'rate')::numeric,amount=(v_line->>'amount')::numeric,discount=(v_line->>'discount')::numeric,raw_data=v_line||jsonb_build_object('shopify_owned',true),updated_at=now() WHERE order_id=v_id AND external_item_id=v_line->>'id';
  ELSE
   INSERT INTO order_items(order_id,external_item_id,item_name,sku,quantity,rate,amount,discount,item_order,raw_data) VALUES(v_id,v_line->>'id',v_line->>'name',v_line->>'sku',(v_line->>'quantity')::numeric,(v_line->>'rate')::numeric,(v_line->>'amount')::numeric,(v_line->>'discount')::numeric,(v_line->>'position')::integer,v_line||jsonb_build_object('shopify_owned',true));
  END IF;
 END LOOP;
 UPDATE order_items SET quantity=0,amount=0,raw_data=raw_data||jsonb_build_object('quantity',0,'amount',0,'removed_from_shopify',true) WHERE order_id=v_id AND raw_data->>'shopify_owned'='true' AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_order->'items') l WHERE l->>'id'=external_item_id);
 INSERT INTO order_import_logs(source_system,external_order_id,order_number,import_status,message) VALUES(v_source,p_order->>'external_id','SHOPIFY '||(p_order->>'name'),v_result,'Shopify-Bestellung übernommen');
 RETURN jsonb_build_object('status',v_result,'order_id',v_id);
END $$;
REVOKE ALL ON FUNCTION public.shopify_apply_order(jsonb,boolean,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.shopify_apply_order(jsonb,boolean,boolean) TO service_role;
CREATE OR REPLACE FUNCTION public.shopify_approve_import(p_run uuid,p_user uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_test integration_logs%ROWTYPE; v_tenant uuid;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'service only'; END IF;
 SELECT id INTO v_tenant FROM tenants WHERE code='DE' AND is_active=true;
 IF NOT EXISTS(SELECT 1 FROM user_profiles WHERE id=p_user AND account_status='active' AND invitation_status='accepted' AND password_reset_required=false) OR NOT EXISTS(SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=p_user AND r.name IN ('Admin','Super Admin')) OR NOT EXISTS(SELECT 1 FROM user_tenant_access WHERE user_id=p_user AND tenant_id=v_tenant) THEN RAISE EXCEPTION 'Approval not allowed'; END IF;
 SELECT * INTO v_test FROM integration_logs WHERE source='shopify:test' AND event='complete' AND external_id=p_run::text AND user_id=p_user AND tenant_id=v_tenant AND status='ok' AND created_at>now()-interval '30 minutes' ORDER BY created_at DESC LIMIT 1;
 IF v_test.id IS NULL OR (v_test.payload->>'errors')::integer<>0 OR (v_test.payload->>'count')::integer<=0 THEN RAISE EXCEPTION 'Successful recent dry run required'; END IF;
 INSERT INTO integration_health(integration,status,tenant_id,shop_config) VALUES('shopify-orders','ready',v_tenant,jsonb_build_object('production_enabled',true,'approved_by',p_user,'approved_at',now(),'approved_run',p_run)) ON CONFLICT(integration) DO UPDATE SET shop_config=coalesce(integration_health.shop_config,'{}')||excluded.shop_config,tenant_id=v_tenant,updated_at=now();
 INSERT INTO integration_logs(source,event,external_id,status,user_id,tenant_id,message) VALUES('shopify:admin','approved',p_run::text,'ok',p_user,v_tenant,'Produktiver Bestellimport ausdrücklich freigegeben');
 RETURN jsonb_build_object('ok',true,'count',v_test.payload->'count');
END $$;
REVOKE ALL ON FUNCTION public.shopify_approve_import(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.shopify_approve_import(uuid,uuid) TO service_role;