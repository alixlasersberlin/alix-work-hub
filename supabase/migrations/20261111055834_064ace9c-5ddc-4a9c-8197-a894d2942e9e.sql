ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shopify_invoice_state jsonb;
CREATE OR REPLACE FUNCTION public.shopify_invoice_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
IF TG_OP='INSERT' THEN
 IF NEW.shopify_invoice_state IS NOT NULL AND coalesce(auth.role(),'')<>'service_role' AND session_user NOT IN ('postgres','supabase_admin') THEN RAISE EXCEPTION 'System managed invoice state'; END IF;
ELSIF NEW.shopify_invoice_state IS DISTINCT FROM OLD.shopify_invoice_state AND coalesce(auth.role(),'')<>'service_role' AND session_user NOT IN ('postgres','supabase_admin') THEN RAISE EXCEPTION 'System managed invoice state'; END IF;
RETURN NEW; END $$;
CREATE TRIGGER shopify_invoice_state_guard BEFORE INSERT OR UPDATE OF shopify_invoice_state ON public.orders FOR EACH ROW EXECUTE FUNCTION public.shopify_invoice_guard();
CREATE OR REPLACE FUNCTION public.shopify_invoice_dispatch(p_order uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,net,vault AS $$
DECLARE o orders%ROWTYPE; secret text; callback text; anon_key text;
BEGIN
SELECT * INTO o FROM orders WHERE id=p_order FOR UPDATE;
IF o.shopify_invoice_state->>'status' IS DISTINCT FROM 'pending' OR coalesce((o.shopify_invoice_state->>'attempts')::int,0)>=5 THEN RETURN; END IF;
SELECT decrypted_secret INTO secret FROM vault.decrypted_secrets WHERE name='CRON_SECRET' LIMIT 1;
SELECT value INTO callback FROM app_settings WHERE key='auto_az_callback_url';
SELECT value INTO anon_key FROM app_settings WHERE key='auto_az_publishable_key';
IF secret IS NULL OR callback IS NULL OR anon_key IS NULL THEN RAISE EXCEPTION 'Invoice callback configuration missing'; END IF;
UPDATE orders SET shopify_invoice_state=shopify_invoice_state||jsonb_build_object('attempts',coalesce((shopify_invoice_state->>'attempts')::int,0)+1) WHERE id=p_order;
PERFORM net.http_post(url:=regexp_replace(callback,'/auto-deposit-invoice$','/shopify-invoice'),headers:=jsonb_build_object('Content-Type','application/json','apikey',anon_key,'x-cron-secret',secret),body:=jsonb_build_object('order_id',p_order),timeout_milliseconds:=120000);
END $$;
CREATE OR REPLACE FUNCTION public.shopify_invoice_enqueue() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
IF NEW.source_system='shopify:0213c2-4.myshopify.com' AND NEW.raw_data->'shopify' IS NOT NULL AND EXISTS(SELECT 1 FROM integration_health WHERE integration='shopify-orders' AND shop_config->>'production_enabled'='true') THEN
UPDATE orders SET shopify_invoice_state=jsonb_build_object('status','pending','attempts',0,'queued_at',now()) WHERE id=NEW.id;
PERFORM public.shopify_invoice_dispatch(NEW.id);
END IF; RETURN NEW; END $$;
CREATE OR REPLACE FUNCTION public.shopify_invoice_retry(p_order uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s jsonb;
BEGIN
SELECT shopify_invoice_state INTO s FROM orders WHERE id=p_order;
IF s->>'status' IN ('sent','sending','uncertain','blocked','skipped') OR coalesce((s->>'attempts')::int,0)>=5 THEN
RETURN;
END IF;
PERFORM public.shopify_invoice_dispatch(p_order);
END $$;
CREATE TRIGGER shopify_invoice_new_order AFTER INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION public.shopify_invoice_enqueue();
CREATE OR REPLACE FUNCTION public.shopify_invoice_claim(p_order uuid,p_snapshot jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o orders%ROWTYPE; i zoho_invoices%ROWTYPE; tenant uuid; claim uuid:=gen_random_uuid(); num text;
BEGIN
IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'service only'; END IF;
SELECT * INTO o FROM orders WHERE id=p_order FOR UPDATE;
IF o.source_system IS DISTINCT FROM 'shopify:0213c2-4.myshopify.com' OR o.shopify_invoice_state IS NULL THEN RETURN NULL; END IF;
IF o.shopify_invoice_state->>'status' IN ('sent','sending','uncertain','blocked','skipped') THEN RETURN NULL; END IF;
IF o.shopify_invoice_state->>'status'='processing' AND (o.shopify_invoice_state->>'lease_until')::timestamptz>now() THEN RETURN NULL; END IF;
IF lower(o.order_status)='storniert' OR (o.raw_data->'shopify'->>'refunded')::numeric>0 THEN RAISE EXCEPTION 'Cancelled/refunded order requires review'; END IF;
IF (p_snapshot->>'total')::numeric IS DISTINCT FROM o.total_amount OR (p_snapshot->>'total')::numeric IS DISTINCT FROM (o.raw_data->'shopify'->>'total')::numeric OR p_snapshot->>'recipient' IS DISTINCT FROM btrim(o.raw_data->'shopify'->>'email') THEN RAISE EXCEPTION 'Snapshot differs from imported order'; END IF;
SELECT id INTO tenant FROM tenants WHERE code='DE' AND is_active;
SELECT * INTO i FROM zoho_invoices WHERE (raw_data->>'order_id'=o.id::text OR reference_number=o.order_number) AND is_deposit IS DISTINCT FROM true ORDER BY created_at LIMIT 1;
IF i.id IS NOT NULL AND i.raw_data->>'created_from' IS DISTINCT FROM 'shopify_auto_invoice' THEN
UPDATE orders SET shopify_invoice_state=shopify_invoice_state||jsonb_build_object('status','skipped','error','Existing invoice requires manual review') WHERE id=p_order; RETURN NULL;
END IF;
IF i.id IS NULL THEN
INSERT INTO zoho_invoices(source_system,zoho_invoice_id,invoice_number,reference_number,customer_id,customer_name,billing_address,invoice_date,due_date,currency,total,balance,status,payment_status,tenant_id,accounting_region,raw_data)
VALUES(o.source_system,'manual-shopify-'||o.id,'SHOPIFY-INV-'||split_part(o.external_order_id,'/',5),o.order_number,o.customer_id::text,o.raw_data->'shopify'->>'customer_name',o.billing_address,(now() AT TIME ZONE 'Europe/Berlin')::date,(now() AT TIME ZONE 'Europe/Berlin')::date,o.currency,o.total_amount,(p_snapshot->>'balance')::numeric,'sent',CASE WHEN (p_snapshot->>'balance')::numeric=0 THEN 'Bezahlt' ELSE 'Offen' END,tenant,'DE',p_snapshot||jsonb_build_object('created_from','shopify_auto_invoice','order_id',o.id,'is_draft',false,'finalized',true,'subtotal',p_snapshot->'net','tax_amount',p_snapshot->'tax','line_items',p_snapshot->'items','shopify_snapshot',o.raw_data->'shopify')) RETURNING * INTO i;
END IF;
num:=public.assign_invoice_number(i.id);
UPDATE orders SET shopify_invoice_state=shopify_invoice_state||jsonb_build_object('status','processing','claim',claim,'lease_until',now()+interval '3 minutes','invoice_id',i.id,'invoice_number',num) WHERE id=p_order;
RETURN jsonb_build_object('claim',claim,'invoice_id',i.id,'number',num,'invoice',to_jsonb(i),'snapshot',i.raw_data,'order_number',o.order_number);
END $$;
CREATE OR REPLACE FUNCTION public.shopify_invoice_transition(p_order uuid,p_claim uuid,p_status text,p_details jsonb DEFAULT '{}') RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'service only'; END IF;
IF p_status NOT IN ('sending','sent','pending','uncertain','blocked') THEN RAISE EXCEPTION 'Invalid state'; END IF;
UPDATE orders SET shopify_invoice_state=shopify_invoice_state||p_details||jsonb_build_object('status',p_status) WHERE id=p_order AND shopify_invoice_state->>'claim'=p_claim::text AND (shopify_invoice_state->>'status'='processing' OR (shopify_invoice_state->>'status'='sending' AND p_status IN ('sent','uncertain','blocked')));
RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION public.shopify_invoice_guard(),public.shopify_invoice_enqueue(),public.shopify_invoice_dispatch(uuid),public.shopify_invoice_retry(uuid),public.shopify_invoice_claim(uuid,jsonb),public.shopify_invoice_transition(uuid,uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.shopify_invoice_dispatch(uuid),public.shopify_invoice_retry(uuid),public.shopify_invoice_claim(uuid,jsonb),public.shopify_invoice_transition(uuid,uuid,text,jsonb) TO service_role;