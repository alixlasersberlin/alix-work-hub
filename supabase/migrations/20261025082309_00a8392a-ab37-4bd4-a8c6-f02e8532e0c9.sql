ALTER TABLE public.integration_health ADD COLUMN IF NOT EXISTS shop_config jsonb, ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
ALTER TABLE public.integration_logs ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
CREATE UNIQUE INDEX IF NOT EXISTS hs_sandbox_identity ON public.integration_logs(source,event,external_id) WHERE source='hollywood-secret:sandbox' AND event IN ('customer','order');
CREATE UNIQUE INDEX IF NOT EXISTS hs_order_identity ON public.orders ((raw_data->>'shop_id'), external_order_id) WHERE raw_data->>'shop_id'='hollywood-secret';
CREATE UNIQUE INDEX IF NOT EXISTS hs_config_identity ON public.integration_health(integration) WHERE integration='hollywood-secret';

CREATE OR REPLACE FUNCTION public.hs_admin_allowed() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $fn$
 SELECT auth.uid() IS NOT NULL AND (public.has_role('Admin') OR public.has_role('Super Admin'))
 AND EXISTS(SELECT 1 FROM public.user_profiles p WHERE p.id=auth.uid() AND p.is_active AND p.account_status='active' AND p.invitation_status='accepted' AND NOT p.password_reset_required)
 AND EXISTS(SELECT 1 FROM public.tenants t WHERE t.code='DE' AND t.is_active AND public.has_tenant_access(t.id) AND public.tenant_scope_id_ok(t.id));
$fn$;
REVOKE ALL ON FUNCTION public.hs_admin_allowed() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.hs_admin_allowed() TO authenticated,service_role;
CREATE POLICY hs_health_scope ON public.integration_health AS RESTRICTIVE TO authenticated USING(integration<>'hollywood-secret' OR public.hs_admin_allowed()) WITH CHECK(integration<>'hollywood-secret' OR public.hs_admin_allowed());
CREATE POLICY hs_logs_scope ON public.integration_logs AS RESTRICTIVE TO authenticated USING(source NOT LIKE 'hollywood-secret%' OR public.hs_admin_allowed()) WITH CHECK(source NOT LIKE 'hollywood-secret%' OR public.hs_admin_allowed());
GRANT SELECT ON public.integration_health,public.integration_logs TO authenticated;
GRANT ALL ON public.integration_health,public.integration_logs,public.api_rate_limits TO service_role;

INSERT INTO public.integration_health(integration,status,tenant_id,shop_config)
SELECT 'hollywood-secret','SETUP_REQUIRED',id,jsonb_build_object('shop_id','hollywood-secret','production_enabled',false,'test_enabled',true,'mappings','{}'::jsonb,'shipping_confirmed',false,'shipping_price_id',null,'free_shipping',false) FROM public.tenants WHERE code='DE'
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.hs_rate_limit(p_mode text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
DECLARE k text; n integer;
BEGIN
 IF auth.role()<>'service_role' OR p_mode NOT IN ('sandbox','production') THEN RAISE EXCEPTION 'HS_FORBIDDEN'; END IF;
 k:='hs:'||p_mode;
 PERFORM pg_advisory_xact_lock(hashtextextended(k,0));
 SELECT count(*) INTO n FROM public.api_rate_limits WHERE bucket_key=k AND request_at>clock_timestamp()-interval '1 minute';
 IF n>=60 THEN RETURN false; END IF;
 INSERT INTO public.api_rate_limits(bucket_key,request_at) VALUES(k,clock_timestamp());
 DELETE FROM public.api_rate_limits WHERE bucket_key=k AND request_at<clock_timestamp()-interval '10 minutes';
 RETURN true;
END;$fn$;
REVOKE ALL ON FUNCTION public.hs_rate_limit(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.hs_rate_limit(text) TO service_role;

CREATE OR REPLACE FUNCTION public.hs_admin(p_action text,p_payload jsonb DEFAULT '{}'::jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
DECLARE h public.integration_health; cfg jsonb; sku text; priceid uuid; off integer;
BEGIN
 IF NOT public.hs_admin_allowed() THEN RAISE EXCEPTION 'HS_FORBIDDEN'; END IF;
 SELECT * INTO h FROM public.integration_health WHERE integration='hollywood-secret' FOR UPDATE;
 IF h.id IS NULL THEN RAISE EXCEPTION 'HS_SETUP_REQUIRED'; END IF;
 cfg:=h.shop_config;
 IF p_action='mapping' THEN
   sku:=p_payload->>'sku'; priceid:=(p_payload->>'price_id')::uuid;
   IF sku IS NULL OR length(sku)>100 OR sku!~'^[A-Za-z0-9_.-]+$' THEN RAISE EXCEPTION 'HS_INVALID_INPUT'; END IF;
   IF NOT EXISTS(SELECT 1 FROM public.catalog_item_prices p JOIN public.catalog_items i ON i.id=p.item_id WHERE p.id=priceid AND p.price_status::text='freigegeben' AND p.currency_code='EUR' AND p.standard_gross>0 AND p.tax_rate IS NOT NULL AND i.status::text IN ('freigegeben','aktiv') AND public.source_to_tenant_code(i.source_system)='DE') THEN RAISE EXCEPTION 'HS_PRICE_NOT_APPROVED'; END IF;
   cfg:=jsonb_set(cfg,ARRAY['mappings',sku],to_jsonb(priceid::text),true);
 ELSIF p_action='remove_mapping' THEN
   cfg:=jsonb_set(cfg,'{mappings}',(cfg->'mappings')-(p_payload->>'sku'));
 ELSIF p_action='shipping' THEN
   IF p_payload->>'free_shipping'='true' THEN cfg:=cfg||jsonb_build_object('free_shipping',true,'shipping_confirmed',true,'shipping_price_id',null);
   ELSE
     priceid:=(p_payload->>'price_id')::uuid;
     IF NOT EXISTS(SELECT 1 FROM public.catalog_item_prices p JOIN public.catalog_items i ON i.id=p.item_id WHERE p.id=priceid AND p.price_status::text='freigegeben' AND p.currency_code='EUR' AND p.standard_gross>=0 AND p.tax_rate IS NOT NULL AND public.source_to_tenant_code(i.source_system)='DE') THEN RAISE EXCEPTION 'HS_PRICE_NOT_APPROVED'; END IF;
     cfg:=cfg||jsonb_build_object('free_shipping',false,'shipping_confirmed',true,'shipping_price_id',priceid);
   END IF;
 ELSIF p_action='test_enabled' THEN cfg:=cfg||jsonb_build_object('test_enabled',COALESCE((p_payload->>'enabled')::boolean,false));
 ELSIF p_action='disable_production' THEN cfg:=cfg||jsonb_build_object('production_enabled',false);
 ELSIF p_action NOT IN ('overview','logs','prices') THEN RAISE EXCEPTION 'HS_INVALID_INPUT'; END IF;
 IF p_action IN ('mapping','remove_mapping','shipping','test_enabled','disable_production') THEN
   UPDATE public.integration_health SET shop_config=cfg,updated_at=now() WHERE id=h.id;
   INSERT INTO public.integration_logs(source,event,status,user_id,tenant_id,message) VALUES('hollywood-secret:admin',p_action,'ok',auth.uid(),h.tenant_id,'Konfiguration geändert');
 END IF;
 IF p_action='prices' THEN
   RETURN COALESCE((SELECT jsonb_agg(x) FROM (SELECT p.id,p.item_id,i.name,i.sku,p.standard_gross,p.tax_rate,p.currency_code,p.valid_from,p.valid_until FROM public.catalog_item_prices p JOIN public.catalog_items i ON i.id=p.item_id WHERE p.price_status::text='freigegeben' AND p.currency_code='EUR' AND p.standard_gross>0 AND p.tax_rate IS NOT NULL AND i.status::text IN ('freigegeben','aktiv') AND public.source_to_tenant_code(i.source_system)='DE' AND (p.valid_from IS NULL OR p.valid_from<=current_date) AND (p.valid_until IS NULL OR p.valid_until>=current_date) ORDER BY i.name,p.id LIMIT 200) x),'[]'::jsonb);
 END IF;
 IF p_action='logs' THEN
   off:=COALESCE((p_payload->>'offset')::integer,0);
   IF off<0 OR off>100000 THEN RAISE EXCEPTION 'HS_INVALID_INPUT'; END IF;
   RETURN jsonb_build_object('rows',COALESCE((SELECT jsonb_agg(x) FROM (SELECT id,created_at,source,event,external_id,status,message FROM public.integration_logs WHERE source LIKE 'hollywood-secret%' ORDER BY created_at DESC,id OFFSET off LIMIT 50) x),'[]'::jsonb),'total',(SELECT count(*) FROM public.integration_logs WHERE source LIKE 'hollywood-secret%'));
 END IF;
 SELECT * INTO h FROM public.integration_health WHERE id=h.id;
 RETURN jsonb_build_object('connection',to_jsonb(h),'orders',(SELECT count(*) FROM public.orders WHERE raw_data->>'shop_id'='hollywood-secret'),'sandbox_orders',(SELECT count(*) FROM public.integration_logs WHERE source='hollywood-secret:sandbox' AND event='order'),'failures',(SELECT count(*) FROM public.integration_logs WHERE source='hollywood-secret:api' AND status='error'));
END;$fn$;
REVOKE ALL ON FUNCTION public.hs_admin(text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.hs_admin(text,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.hs_api(p_mode text,p_action text,p_payload jsonb,p_hash text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
DECLARE h public.integration_health; cfg jsonb; src text; ext text; email text; cust jsonb; cid uuid; oid uuid; o public.orders; rec public.integration_logs; c public.customers; item jsonb; lines jsonb:='[]'; price public.catalog_item_prices; article public.catalog_items; priceid uuid; qty integer; cents bigint; netcents bigint; taxcents bigint; totalcents bigint:=0; shippingcents bigint:=0; shippingtax numeric:=0; response jsonb; key text;
BEGIN
 IF auth.role()<>'service_role' OR p_mode NOT IN ('sandbox','production') THEN RAISE EXCEPTION 'HS_FORBIDDEN'; END IF;
 IF p_payload->>'shop_id' IS DISTINCT FROM 'hollywood-secret' THEN RAISE EXCEPTION 'HS_FORBIDDEN'; END IF;
 SELECT * INTO h FROM public.integration_health WHERE integration='hollywood-secret';
 IF h.id IS NULL OR NOT EXISTS(SELECT 1 FROM public.tenants WHERE id=h.tenant_id AND code='DE' AND is_active) THEN RAISE EXCEPTION 'HS_SETUP_REQUIRED'; END IF;
 cfg:=h.shop_config;
 IF p_mode='production' AND COALESCE((cfg->>'production_enabled')::boolean,false)=false THEN RAISE EXCEPTION 'HS_PRODUCTION_DISABLED'; END IF;
 IF p_mode='sandbox' AND COALESCE((cfg->>'test_enabled')::boolean,false)=false THEN RAISE EXCEPTION 'HS_TEST_DISABLED'; END IF;
 src:='hollywood-secret:'||p_mode;
 ext:=p_payload->>'external_order_id';
 IF p_action IN ('create_order','get_order') THEN
   IF ext IS NULL OR length(ext)>128 OR ext!~'^[A-Za-z0-9_.-]+$' THEN RAISE EXCEPTION 'HS_INVALID_INPUT'; END IF;
   PERFORM pg_advisory_xact_lock(hashtextextended(src||':order:'||ext,0));
   IF p_mode='sandbox' THEN
     SELECT * INTO rec FROM public.integration_logs WHERE source=src AND event='order' AND external_id=ext;
     IF rec.id IS NOT NULL THEN
       IF p_action='create_order' AND rec.payload->>'request_hash' IS DISTINCT FROM p_hash THEN RAISE EXCEPTION 'HS_IDEMPOTENCY_CONFLICT'; END IF;
       RETURN (rec.payload->'response')||jsonb_build_object('replayed',p_action='create_order');
     END IF;
   ELSE
     SELECT * INTO o FROM public.orders WHERE raw_data->>'shop_id'='hollywood-secret' AND external_order_id=ext AND source_system='zoho_eu_1' AND accounting_region='EU';
     IF o.id IS NOT NULL THEN
       IF p_action='create_order' AND o.raw_data->>'shop_request_hash' IS DISTINCT FROM p_hash THEN RAISE EXCEPTION 'HS_IDEMPOTENCY_CONFLICT'; END IF;
       RETURN jsonb_build_object('shop_id','hollywood-secret','mode',p_mode,'external_order_id',ext,'order_id',o.id,'order_number',o.order_number,'status',o.order_status,'currency',o.currency,'total_cents',round(o.total_amount*100),'payment',jsonb_build_object('status',COALESCE(o.finance_payment_status,'unverified'),'paid_amount',o.finance_paid_amount,'open_amount',o.finance_open_amount),'invoices',COALESCE((SELECT jsonb_agg(jsonb_build_object('invoice_number',z.invoice_number,'invoice_date',z.invoice_date,'total',z.total,'balance',z.balance,'status',z.status)) FROM public.zoho_invoices z WHERE z.source_system=o.source_system AND z.reference_number=o.order_number AND z.tenant_id=h.tenant_id AND z.accounting_region='EU' AND z.customer_id=(SELECT external_customer_id FROM public.customers WHERE id=o.customer_id)),'[]'::jsonb),'shipping',jsonb_build_object('status',o.order_status,'expected_shipment_date',o.expected_shipment_date),'replayed',p_action='create_order');
     END IF;
   END IF;
   IF p_action='get_order' THEN RAISE EXCEPTION 'HS_NOT_FOUND'; END IF;
   IF p_hash IS NULL OR length(p_hash)<>64 THEN RAISE EXCEPTION 'HS_INVALID_INPUT'; END IF;
 END IF;

 IF p_action IN ('create_customer','find_customer','create_order') THEN
   cust:=CASE WHEN p_action='create_order' THEN p_payload->'customer' ELSE p_payload->'customer' END;
   email:=lower(trim(COALESCE(cust->>'email',p_payload->>'email')));
   key:=cust->>'external_customer_id';
   IF email IS NULL OR length(email)>254 OR email!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN RAISE EXCEPTION 'HS_INVALID_INPUT'; END IF;
   IF p_action<>'find_customer' AND (key IS NULL OR length(key)>128 OR key!~'^[A-Za-z0-9_.-]+$' OR length(COALESCE(cust->>'name',''))<1 OR length(cust->>'name')>200) THEN RAISE EXCEPTION 'HS_INVALID_INPUT'; END IF;
   IF p_action='find_customer' THEN
     IF p_mode='sandbox' THEN SELECT * INTO rec FROM public.integration_logs WHERE source=src AND event='customer' AND payload->>'email'=email ORDER BY created_at LIMIT 1;
       RETURN jsonb_build_object('customer',CASE WHEN rec.id IS NULL THEN NULL ELSE rec.payload->'response' END);
     ELSE SELECT * INTO c FROM public.customers WHERE raw_data->>'shop_id'='hollywood-secret' AND source_system='zoho_eu_1' AND accounting_region='EU' AND lower(customers.email)=email ORDER BY created_at LIMIT 1;
       RETURN jsonb_build_object('customer',CASE WHEN c.id IS NULL THEN NULL ELSE jsonb_build_object('id',c.id,'external_customer_id',c.raw_data->>'shop_customer_id','name',c.contact_name,'email',c.email) END);
     END IF;
   END IF;
   PERFORM pg_advisory_xact_lock(hashtextextended(src||':customer:'||key,0));
   IF p_mode='sandbox' THEN
     SELECT * INTO rec FROM public.integration_logs WHERE source=src AND event='customer' AND external_id=key;
     IF rec.id IS NOT NULL THEN
       IF rec.payload->>'email' IS DISTINCT FROM email THEN RAISE EXCEPTION 'HS_CUSTOMER_CONFLICT'; END IF;
       cid:=(rec.payload->'response'->>'id')::uuid;
     ELSE
       cid:=gen_random_uuid(); response:=jsonb_build_object('id',cid,'external_customer_id',key,'name',cust->>'name','email',email);
       INSERT INTO public.integration_logs(source,event,external_id,status,tenant_id,payload) VALUES(src,'customer',key,'test',h.tenant_id,jsonb_build_object('email',email,'response',response));
     END IF;
     IF p_action='create_customer' THEN RETURN jsonb_build_object('customer',jsonb_build_object('id',cid,'external_customer_id',key,'email',email),'mode',p_mode); END IF;
   ELSE
     SELECT * INTO c FROM public.customers WHERE source_system='zoho_eu_1' AND external_customer_id='HS:'||key AND raw_data->>'shop_id'='hollywood-secret' AND accounting_region='EU';
     IF c.id IS NOT NULL THEN
       IF lower(c.email) IS DISTINCT FROM email THEN RAISE EXCEPTION 'HS_CUSTOMER_CONFLICT'; END IF;
       cid:=c.id;
     ELSE
       INSERT INTO public.customers(source_system,external_customer_id,contact_name,email,phone,company_name,billing_address,shipping_address,accounting_region,raw_data,contact_tenant_id) VALUES('zoho_eu_1','HS:'||key,cust->>'name',email,cust->>'phone',cust->>'company',cust->'billing_address',cust->'shipping_address','EU',jsonb_build_object('shop_id','hollywood-secret','shop_customer_id',key),h.tenant_id) RETURNING id INTO cid;
     END IF;
     IF p_action='create_customer' THEN RETURN jsonb_build_object('customer',jsonb_build_object('id',cid,'external_customer_id',key,'email',email),'mode',p_mode); END IF;
   END IF;
 END IF;
 IF p_action<>'create_order' THEN RAISE EXCEPTION 'HS_INVALID_INPUT'; END IF;
 IF jsonb_typeof(p_payload->'items') IS DISTINCT FROM 'array' OR jsonb_array_length(p_payload->'items')<1 OR jsonb_array_length(p_payload->'items')>100 OR p_payload->>'currency' IS DISTINCT FROM 'EUR' THEN RAISE EXCEPTION 'HS_INVALID_INPUT'; END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(p_payload->'items') LOOP
   qty:=(item->>'quantity')::integer;
   IF qty<1 OR qty>1000 THEN RAISE EXCEPTION 'HS_INVALID_INPUT'; END IF;
   IF p_mode='sandbox' THEN
     IF item->>'sku' IS DISTINCT FROM 'HS-TEST-10' THEN RAISE EXCEPTION 'HS_UNKNOWN_ARTICLE'; END IF;
     cents:=1000; priceid:=NULL; article.id:=NULL; article.name:='Isolierter API-Testartikel'; shippingtax:=19;
     netcents:=round((cents*qty)/1.19); taxcents:=cents*qty-netcents;
   ELSE
     priceid:=(cfg->'mappings'->>(item->>'sku'))::uuid;
     IF priceid IS NULL THEN RAISE EXCEPTION 'HS_UNKNOWN_ARTICLE'; END IF;
     SELECT * INTO price FROM public.catalog_item_prices WHERE id=priceid AND price_status::text='freigegeben' AND currency_code='EUR' AND standard_gross>0 AND tax_rate>=0 AND tax_rate<=100 AND (valid_from IS NULL OR valid_from<=current_date) AND (valid_until IS NULL OR valid_until>=current_date);
     IF price.id IS NULL THEN RAISE EXCEPTION 'HS_PRICE_NOT_APPROVED'; END IF;
     SELECT * INTO article FROM public.catalog_items WHERE id=price.item_id AND status::text IN ('freigegeben','aktiv') AND public.source_to_tenant_code(source_system)='DE';
     IF article.id IS NULL THEN RAISE EXCEPTION 'HS_PRICE_NOT_APPROVED'; END IF;
     cents:=round(price.standard_gross*100); netcents:=round((cents*qty)/(1+price.tax_rate/100)); taxcents:=cents*qty-netcents;
   END IF;
   IF (item->>'unit_price_cents')::bigint IS DISTINCT FROM cents THEN RAISE EXCEPTION 'HS_PRICE_MISMATCH'; END IF;
   totalcents:=totalcents+cents*qty;
   lines:=lines||jsonb_build_array(jsonb_build_object('sku',item->>'sku','name',article.name,'quantity',qty,'gross_cents',cents*qty,'net_cents',netcents,'tax_cents',taxcents,'price_id',priceid,'item_id',article.id));
 END LOOP;
 IF p_mode='production' THEN
   IF COALESCE((cfg->>'shipping_confirmed')::boolean,false)=false THEN RAISE EXCEPTION 'HS_SHIPPING_NOT_APPROVED'; END IF;
   IF COALESCE((cfg->>'free_shipping')::boolean,false)=false THEN
     SELECT * INTO price FROM public.catalog_item_prices WHERE id=(cfg->>'shipping_price_id')::uuid AND price_status::text='freigegeben' AND currency_code='EUR' AND standard_gross>=0 AND tax_rate>=0 AND tax_rate<=100 AND (valid_from IS NULL OR valid_from<=current_date) AND (valid_until IS NULL OR valid_until>=current_date);
     IF price.id IS NULL THEN RAISE EXCEPTION 'HS_SHIPPING_NOT_APPROVED'; END IF;
     shippingcents:=round(price.standard_gross*100); shippingtax:=price.tax_rate;
   END IF;
 END IF;
 IF (p_payload->>'shipping_cents')::bigint IS DISTINCT FROM shippingcents OR (p_payload->>'total_cents')::bigint IS DISTINCT FROM totalcents+shippingcents THEN RAISE EXCEPTION 'HS_PRICE_MISMATCH'; END IF;
 oid:=gen_random_uuid();
 IF p_mode='sandbox' THEN
   response:=jsonb_build_object('shop_id','hollywood-secret','mode','sandbox','external_order_id',ext,'order_id',oid,'order_number','HS-TEST-'||ext,'customer_id',cid,'status','test_created','currency','EUR','total_cents',totalcents+shippingcents,'items',lines,'payment',jsonb_build_object('status','unverified'),'invoices','[]'::jsonb,'shipping',jsonb_build_object('status','not_shipped'),'replayed',false);
   INSERT INTO public.integration_logs(source,event,external_id,status,tenant_id,payload) VALUES(src,'order',ext,'test',h.tenant_id,jsonb_build_object('request_hash',p_hash,'response',response));
 ELSE
   INSERT INTO public.orders(id,customer_id,external_order_id,order_number,source_system,order_status,currency,total_amount,order_date,billing_address,shipping_address,accounting_region,raw_data)
   VALUES(oid,cid,ext,'HS-'||ext,'zoho_eu_1','offen','EUR',(totalcents+shippingcents)/100.0,now(),cust->'billing_address',cust->'shipping_address','EU',jsonb_build_object('shop_id','hollywood-secret','shop_request_hash',p_hash,'shop_payment_report',p_payload->'payment_report','shop_mode','production'));
   FOR item IN SELECT value FROM jsonb_array_elements(lines) LOOP
     INSERT INTO public.order_items(order_id,external_item_id,item_name,sku,quantity,rate,amount,tax_amount,raw_data) VALUES(oid,item->>'sku',item->>'name',item->>'sku',(item->>'quantity')::integer,(item->>'net_cents')::numeric/100/(item->>'quantity')::integer,(item->>'net_cents')::numeric/100,(item->>'tax_cents')::numeric/100,item);
   END LOOP;
   IF shippingcents>0 THEN INSERT INTO public.order_items(order_id,external_item_id,item_name,quantity,rate,amount,tax_amount) VALUES(oid,'HS-SHIPPING','Versand',1,round(shippingcents/(1+shippingtax/100))/100,round(shippingcents/(1+shippingtax/100))/100,(shippingcents-round(shippingcents/(1+shippingtax/100)))/100); END IF;
   response:=jsonb_build_object('shop_id','hollywood-secret','mode','production','external_order_id',ext,'order_id',oid,'order_number','HS-'||ext,'customer_id',cid,'status','offen','currency','EUR','total_cents',totalcents+shippingcents,'payment',jsonb_build_object('status','unverified'),'invoices','[]'::jsonb,'shipping',jsonb_build_object('status','offen'),'replayed',false);
 END IF;
 UPDATE public.integration_health SET status=CASE WHEN p_mode='sandbox' THEN 'TEST_OK' ELSE 'CONNECTED' END,last_success_at=now(),updated_at=now() WHERE id=h.id;
 RETURN response;
END;$fn$;
REVOKE ALL ON FUNCTION public.hs_api(text,text,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.hs_api(text,text,jsonb,text) TO service_role;