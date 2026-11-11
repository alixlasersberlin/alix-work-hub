DO $$ DECLARE def text; BEGIN SELECT pg_get_functiondef(oid) INTO def FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='shopify_invoice_claim'; def:=replace(def,$s$tenant,'DE',p_snapshot$s$,$s$tenant,'EU',p_snapshot$s$); EXECUTE def; END $$;
CREATE OR REPLACE FUNCTION public.shopify_invoice_dispatch(p_order uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,net,vault AS $$
DECLARE o orders%ROWTYPE; secret text; anon_key text;
BEGIN
SELECT * INTO o FROM orders WHERE id=p_order FOR UPDATE;
IF o.shopify_invoice_state->>'status' IS DISTINCT FROM 'pending' OR coalesce((o.shopify_invoice_state->>'attempts')::int,0)>=5 THEN RETURN; END IF;
SELECT decrypted_secret INTO secret FROM vault.decrypted_secrets WHERE name='CRON_SECRET' LIMIT 1;
SELECT value INTO anon_key FROM app_settings WHERE key='auto_az_publishable_key';
IF secret IS NULL OR anon_key IS NULL THEN RAISE EXCEPTION 'Invoice callback configuration missing'; END IF;
UPDATE orders SET shopify_invoice_state=shopify_invoice_state||jsonb_build_object('attempts',coalesce((shopify_invoice_state->>'attempts')::int,0)+1) WHERE id=p_order;
PERFORM net.http_post(url:='https://xmrmkgfgpoundfwhnxfs.supabase.co/functions/v1/shopify-invoice',headers:=jsonb_build_object('Content-Type','application/json','apikey',anon_key,'x-cron-secret',secret),body:=jsonb_build_object('order_id',p_order),timeout_milliseconds:=120000);
END $$;
REVOKE ALL ON FUNCTION public.shopify_invoice_dispatch(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.shopify_invoice_dispatch(uuid) TO service_role;