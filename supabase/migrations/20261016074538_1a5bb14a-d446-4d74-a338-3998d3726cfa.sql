ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS auto_az jsonb;

CREATE OR REPLACE FUNCTION public.auto_az_arm(p_order_id uuid, p_at timestamptz) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,cron AS $$
DECLARE v_at timestamptz := date_trunc('minute', greatest(p_at,now())) + interval '1 minute'; v_name text := 'auto-az-'||p_order_id; v_job bigint;
BEGIN
 SELECT jobid INTO v_job FROM cron.job WHERE jobname=v_name;
 IF v_job IS NOT NULL THEN PERFORM cron.unschedule(v_job); END IF;
 PERFORM cron.schedule(v_name,format('%s %s %s %s *',extract(minute from v_at)::int,extract(hour from v_at)::int,extract(day from v_at)::int,extract(month from v_at)::int),format('SELECT public.auto_az_dispatch(%L::uuid);',p_order_id));
END $$;

CREATE OR REPLACE FUNCTION public.auto_az_dispatch(p_order_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,cron,vault,net AS $$
DECLARE o public.orders%ROWTYPE; v_job bigint; v_secret text; v_url text; v_anon text;
BEGIN
 SELECT jobid INTO v_job FROM cron.job WHERE jobname='auto-az-'||p_order_id;
 IF v_job IS NOT NULL THEN PERFORM cron.unschedule(v_job); END IF;
 SELECT * INTO o FROM public.orders WHERE id=p_order_id FOR UPDATE;
 IF o.auto_az IS NULL OR o.auto_az->>'status' IN ('sent','failed','cancelled','skipped') THEN RETURN; END IF;
 IF lower(coalesce(o.order_status,'')) IN ('storniert','cancelled','abgelehnt') THEN
  UPDATE public.orders SET auto_az=auto_az||jsonb_build_object('status','cancelled') WHERE id=o.id; RETURN;
 END IF;
 IF (o.auto_az->>'due_at')::timestamptz > now() THEN PERFORM public.auto_az_arm(o.id,(o.auto_az->>'due_at')::timestamptz); RETURN; END IF;
 IF coalesce((o.auto_az->>'dispatches')::int,0)>=5 THEN
  UPDATE public.orders SET auto_az=auto_az||jsonb_build_object('status','failed','error','Automatischer Versand nach fünf Versuchen angehalten') WHERE id=o.id; RETURN;
 END IF;
 SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name='CRON_SECRET' LIMIT 1;
 SELECT value INTO v_url FROM public.app_settings WHERE key='auto_az_callback_url';
 SELECT value INTO v_anon FROM public.app_settings WHERE key='auto_az_publishable_key';
 IF v_secret IS NULL OR v_url IS NULL OR v_anon IS NULL THEN RAISE EXCEPTION 'Automatische AZ-Konfiguration fehlt'; END IF;
 UPDATE public.orders SET auto_az=auto_az||jsonb_build_object('dispatches',coalesce((auto_az->>'dispatches')::int,0)+1) WHERE id=o.id;
 PERFORM public.auto_az_arm(o.id,now()+interval '15 minutes');
 PERFORM net.http_post(url:=v_url,headers:=jsonb_build_object('Content-Type','application/json','apikey',v_anon,'x-cron-secret',v_secret),body:=jsonb_build_object('order_id',o.id),timeout_milliseconds:=120000);
END $$;

CREATE OR REPLACE FUNCTION public.auto_az_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  IF NEW.auto_az IS NOT NULL AND coalesce(auth.role(),'')<>'service_role' AND session_user NOT IN ('postgres','supabase_admin') THEN RAISE EXCEPTION 'Automatikstatus ist systemverwaltet'; END IF;
 ELSIF NEW.auto_az IS DISTINCT FROM OLD.auto_az AND coalesce(auth.role(),'')<>'service_role' AND session_user NOT IN ('postgres','supabase_admin') THEN RAISE EXCEPTION 'Automatikstatus ist systemverwaltet';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER trg_auto_az_guard BEFORE INSERT OR UPDATE OF auto_az ON public.orders FOR EACH ROW EXECUTE FUNCTION public.auto_az_guard();

CREATE OR REPLACE FUNCTION public.auto_az_enqueue(p_order_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o public.orders%ROWTYPE; r public.alix_sign_requests%ROWTYPE; v_due timestamptz;
BEGIN
 SELECT * INTO o FROM public.orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Auftrag fehlt'; END IF;
 IF o.auto_az IS NOT NULL THEN RETURN o.auto_az; END IF;
 IF o.raw_data->>'from_alix_sign' IS DISTINCT FROM 'true' OR coalesce(o.deposit_amount,0)<=0 THEN RETURN NULL; END IF;
 SELECT * INTO r FROM public.alix_sign_requests WHERE status='unterschrieben' AND customer_id=o.customer_id AND offer_number='ANG-'||regexp_replace(o.order_number,'^AB-','') ORDER BY signed_at DESC LIMIT 1;
 IF r.id IS NULL OR r.signed_at IS NULL THEN RAISE EXCEPTION 'Keine bestätigte Alix-Sign-Unterschrift'; END IF;
 v_due:=now()+interval '2 hours';
 UPDATE public.orders SET signature_status='signiert',signature_signed_at=r.signed_at,auto_az=jsonb_build_object('status','pending','finalized_at',now(),'due_at',v_due,'dispatches',0,'sign_request_id',r.id) WHERE id=o.id RETURNING * INTO o;
 PERFORM public.auto_az_arm(o.id,v_due);
 RETURN o.auto_az;
END $$;

CREATE OR REPLACE FUNCTION public.auto_az_claim(p_order_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o public.orders%ROWTYPE; v_token uuid:=gen_random_uuid();
BEGIN
 SELECT * INTO o FROM public.orders WHERE id=p_order_id FOR UPDATE;
 IF o.auto_az IS NULL OR o.auto_az->>'status' IN ('sent','failed','cancelled','skipped') OR (o.auto_az->>'due_at')::timestamptz>now() THEN RETURN NULL; END IF;
 IF o.auto_az->>'status'='processing' AND (o.auto_az->>'lease_until')::timestamptz>now() THEN RETURN NULL; END IF;
 IF lower(coalesce(o.order_status,'')) IN ('storniert','cancelled','abgelehnt') THEN RETURN NULL; END IF;
 UPDATE public.orders SET auto_az=auto_az||jsonb_build_object('status','processing','claim',v_token,'lease_until',now()+interval '10 minutes') WHERE id=o.id RETURNING * INTO o;
 RETURN jsonb_build_object('order',to_jsonb(o),'claim',v_token);
END $$;

CREATE OR REPLACE FUNCTION public.auto_az_prepare(p_order_id uuid,p_claim uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o public.orders%ROWTYPE; d public.finance_deposits%ROWTYPE; c public.customers%ROWTYPE; i public.zoho_invoices%ROWTYPE; v_no text; v_ref text; v_net numeric; v_vat numeric; v_rate numeric; v_date date:=(now() AT TIME ZONE 'Europe/Berlin')::date;
BEGIN
 SELECT * INTO o FROM public.orders WHERE id=p_order_id FOR UPDATE;
 IF o.auto_az->>'claim' IS DISTINCT FROM p_claim::text OR o.auto_az->>'status'<>'processing' THEN RAISE EXCEPTION 'Ungültiger Verarbeitungsauftrag'; END IF;
 SELECT * INTO c FROM public.customers WHERE id=o.customer_id;
 IF coalesce(trim(c.email),'')='' THEN RAISE EXCEPTION 'Kunde hat keine E-Mail-Adresse'; END IF;
 v_ref:='order:'||o.id||':AZ-'||o.order_number;
 SELECT * INTO d FROM public.finance_deposits WHERE order_id=o.id AND source='alixwork' AND (source_ref=v_ref OR (source_ref='order:'||o.id AND invoice_number IS NULL AND gross_amount=o.deposit_amount AND status<>'storniert')) ORDER BY (source_ref=v_ref) DESC LIMIT 1 FOR UPDATE;
 IF d.id IS NULL AND EXISTS(SELECT 1 FROM public.finance_deposits WHERE order_id=o.id AND status<>'storniert' AND invoice_number IS NOT NULL) THEN
  UPDATE public.orders SET auto_az=auto_az||jsonb_build_object('status','skipped','error','Anzahlungsrechnung bereits manuell erstellt') WHERE id=o.id;
  RETURN jsonb_build_object('skipped',true);
 END IF;
 IF d.id IS NOT NULL AND d.source_ref=v_ref AND d.status<>'entwurf' AND o.auto_az->>'invoice_id' IS NULL THEN
  UPDATE public.orders SET auto_az=auto_az||jsonb_build_object('status','skipped','error','Anzahlungsrechnung bereits manuell erstellt') WHERE id=o.id;
  RETURN jsonb_build_object('skipped',true);
 END IF;
 v_rate:=coalesce(o.az_tax_percentage,CASE WHEN o.accounting_region='CH' THEN 0 ELSE 19 END); v_net:=round(o.deposit_amount/(1+v_rate/100),2); v_vat:=o.deposit_amount-v_net;
 IF d.id IS NULL THEN
  INSERT INTO public.finance_deposits(source,source_ref,deposit_number,invoice_number,customer_id,customer_name,company_name,contact_name,order_id,order_number,currency,net_amount,vat_amount,gross_amount,paid_amount,issue_date,due_date,status,release_status,accounting_region,tenant_id,note)
  VALUES('alixwork',v_ref,'AZ-'||o.order_number,'AZ-'||o.order_number,c.id,coalesce(c.company_name,c.contact_name),c.company_name,c.contact_name,o.id,o.order_number,coalesce(o.currency,'EUR'),v_net,v_vat,o.deposit_amount,0,v_date,v_date+14,'offen','wartet',o.accounting_region,c.contact_tenant_id,'Automatische Anzahlungsrechnung nach Alix Sign') RETURNING * INTO d;
 ELSE
  UPDATE public.finance_deposits SET source_ref=v_ref,deposit_number='AZ-'||o.order_number,invoice_number='AZ-'||o.order_number,net_amount=v_net,vat_amount=v_vat,issue_date=coalesce((o.auto_az->>'issue_date')::date,v_date),due_date=coalesce((o.auto_az->>'issue_date')::date,v_date)+14,status=CASE WHEN status='entwurf' THEN 'offen' ELSE status END,note=coalesce(note||E'\n','')||'Automatische Anzahlungsrechnung nach Alix Sign' WHERE id=d.id RETURNING * INTO d;
 END IF;
 SELECT * INTO i FROM public.zoho_invoices WHERE zoho_invoice_id='auto-az-'||o.id FOR UPDATE;
 IF i.id IS NULL THEN
  INSERT INTO public.zoho_invoices(source_system,zoho_invoice_id,invoice_number,reference_number,customer_id,customer_name,billing_address,invoice_date,due_date,currency,total,balance,status,payment_status,is_deposit,deposit_id,tenant_id,accounting_region,raw_data)
  VALUES(coalesce(c.source_system,'zoho_eu_1'),'auto-az-'||o.id,'AZ-'||o.order_number,o.order_number,c.id,coalesce(c.company_name,c.contact_name),c.billing_address,d.issue_date,d.due_date,d.currency,d.gross_amount,greatest(d.gross_amount-coalesce(d.paid_amount,0),0),'sent','Offen',true,d.id,d.tenant_id,o.accounting_region,jsonb_build_object('created_from','alix_sign_auto_az','finalized',true,'is_draft',false,'subtotal',v_net,'tax_rate',v_rate,'tax_amount',v_vat,'line_items',jsonb_build_array(jsonb_build_object('name','Anzahlung gemäß Auftrag '||o.order_number,'quantity',1,'rate',v_net,'amount',v_net)))) RETURNING * INTO i;
 END IF;
 v_no:=public.assign_invoice_number(i.id);
 UPDATE public.finance_deposits SET linked_invoice_table='zoho_invoices',linked_invoice_id=i.id,invoice_id=i.id WHERE id=d.id;
 UPDATE public.orders SET auto_az=auto_az||jsonb_build_object('invoice_id',i.id,'deposit_id',d.id,'invoice_number',v_no,'issue_date',d.issue_date) WHERE id=o.id;
 RETURN jsonb_build_object('order',to_jsonb(o),'customer',to_jsonb(c),'deposit',to_jsonb(d),'invoice_number',v_no,'invoice_id',i.id);
END $$;

CREATE OR REPLACE FUNCTION public.auto_az_finish(p_order_id uuid,p_claim uuid,p_success boolean,p_details jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,cron AS $$
DECLARE v_job bigint;
BEGIN
 UPDATE public.orders SET auto_az=auto_az||coalesce(p_details,'{}')||jsonb_build_object('status',CASE WHEN p_success THEN 'sent' ELSE 'pending' END,'lease_until',null,'claim',null) WHERE id=p_order_id AND auto_az->>'claim'=p_claim::text;
 IF NOT FOUND THEN RAISE EXCEPTION 'Verarbeitungsauftrag wurde geändert'; END IF;
 IF p_success THEN
  SELECT jobid INTO v_job FROM cron.job WHERE jobname='auto-az-'||p_order_id;
  IF v_job IS NOT NULL THEN PERFORM cron.unschedule(v_job); END IF;
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.auto_az_arm(uuid,timestamptz),public.auto_az_dispatch(uuid),public.auto_az_enqueue(uuid),public.auto_az_claim(uuid),public.auto_az_prepare(uuid,uuid),public.auto_az_finish(uuid,uuid,boolean,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.auto_az_enqueue(uuid),public.auto_az_claim(uuid),public.auto_az_prepare(uuid,uuid),public.auto_az_finish(uuid,uuid,boolean,jsonb) TO service_role;