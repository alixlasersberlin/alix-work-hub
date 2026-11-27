CREATE UNIQUE INDEX IF NOT EXISTS ph2_event_id_unique ON public.ph_sync_log ((payload->'signal'->>'event_id')) WHERE operation='ph2_signal';
CREATE INDEX IF NOT EXISTS ph2_queue_lookup ON public.ph_sync_log (product_id,channel_code,created_at DESC) WHERE operation='ph2_signal';

CREATE OR REPLACE FUNCTION public.ph2_guard_reserved() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF TG_TABLE_NAME='ph_settings' THEN
  IF (CASE WHEN TG_OP='DELETE' THEN OLD.key ELSE NEW.key END) LIKE 'ph2_%' AND current_user NOT IN ('postgres','supabase_admin','service_role') AND coalesce(auth.role(),'') <> 'service_role' THEN
   RAISE EXCEPTION 'Geschützte PRODUCT-HUB-Einstellung';
  END IF;
 ELSE
  IF (CASE WHEN TG_OP='DELETE' THEN OLD.operation ELSE NEW.operation END)='ph2_signal' AND current_user NOT IN ('postgres','supabase_admin','service_role') AND coalesce(auth.role(),'') <> 'service_role' THEN
   RAISE EXCEPTION 'Geschütztes PRODUCT-HUB-Ereignis';
  END IF;
 END IF;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
REVOKE ALL ON FUNCTION public.ph2_guard_reserved() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER ph2_settings_guard BEFORE INSERT OR UPDATE OR DELETE ON public.ph_settings FOR EACH ROW EXECUTE FUNCTION public.ph2_guard_reserved();
CREATE TRIGGER ph2_log_guard BEFORE INSERT OR UPDATE OR DELETE ON public.ph_sync_log FOR EACH ROW EXECUTE FUNCTION public.ph2_guard_reserved();
INSERT INTO public.ph_settings(key,value) VALUES
 ('ph2_activation','{"enabled":false,"backup_verified":false,"restore_verified":false,"communication_verified":false,"approved_by":null}'::jsonb),
 ('ph2_ui_preview','{"enabled":true,"test_only":true}'::jsonb)
ON CONFLICT(key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.ph2_capture(_product_id uuid,_source text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p public.ph_products; ch text; held boolean; snapshot jsonb; prev public.ph_sync_log; ev uuid; v text; active boolean;
BEGIN
 IF length(_source)>80 THEN RAISE EXCEPTION 'Invalid source'; END IF;
 PERFORM pg_advisory_xact_lock(272003,hashtext(_product_id::text));
 SELECT * INTO p FROM public.ph_products WHERE id=_product_id;
 IF NOT FOUND THEN RETURN; END IF;
 snapshot:=jsonb_build_object('id',p.id,'alix_product_id',p.alix_product_id,'name',p.name,'slug',p.slug,'status',p.status,'hero_image_url',p.hero_image_url,'active_de',p.active_de,'active_com',p.active_com,'active_dubai',p.active_dubai);
 SELECT coalesce((value->>'enabled')::boolean,false) INTO active FROM public.ph_settings WHERE key='ph2_activation';
 FOREACH ch IN ARRAY ARRAY['de','com','dubai'] LOOP
  SELECT coalesce(bool_or(hold),false) INTO held FROM public.ph_product_channels WHERE product_id=p.id AND
   CASE lower(trim(channel_code)) WHEN 'ae' THEN 'dubai' WHEN 'uae' THEN 'dubai' WHEN 'global' THEN 'com' ELSE lower(trim(channel_code)) END=ch;
  SELECT * INTO prev FROM public.ph_sync_log WHERE operation='ph2_signal' AND product_id=p.id AND channel_code=ch ORDER BY created_at DESC,id DESC LIMIT 1;
  IF prev.id IS NOT NULL AND prev.payload->>'txid'=txid_current()::text AND prev.status IN ('queued','queued_shadow') THEN
   UPDATE public.ph_sync_log SET payload=payload||jsonb_build_object('snapshot',snapshot,'hold',held,'source',_source) WHERE id=prev.id;
   CONTINUE;
  END IF;
  ev:=gen_random_uuid();
  v:=to_char(greatest(clock_timestamp(),coalesce((prev.payload->'signal'->>'version')::timestamptz,'epoch')+interval '1 microsecond') AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"');
  UPDATE public.ph_sync_log SET status='superseded',message='Durch neuere Produktversion ersetzt' WHERE operation='ph2_signal' AND product_id=p.id AND channel_code=ch AND status NOT IN ('superseded','website_confirmed');
  INSERT INTO public.ph_sync_log(id,product_id,channel_code,direction,operation,status,message,payload) VALUES
   (ev,p.id,ch,CASE WHEN active THEN 'outbound' ELSE 'shadow' END,'ph2_signal',CASE WHEN active THEN 'queued' ELSE 'queued_shadow' END,'Änderung dauerhaft erfasst; Entscheidung ausstehend',
    jsonb_build_object('signal',jsonb_build_object('event','product.changed','event_id',ev,'product_id',coalesce(nullif(p.alix_product_id,''),p.id::text),'channel',ch,'version',v,'desired',null,'issued_at',v),'snapshot',snapshot,'hold',held,'source',_source,'attempts',0,'next_attempt_at',now(),'last_error',null,'confirmation','unknown','txid',txid_current()::text,'shadow_mode',NOT coalesce(active,false)));
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.ph2_capture(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ph2_capture(uuid,text) TO service_role;

CREATE OR REPLACE FUNCTION public.ph2_change_trigger() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE pid uuid; oldpid uuid;
BEGIN
 IF TG_TABLE_NAME='ph_products' THEN
  IF TG_OP='UPDATE' AND (to_jsonb(OLD)-ARRAY['updated_at','updated_by','notes'])=(to_jsonb(NEW)-ARRAY['updated_at','updated_by','notes']) THEN RETURN NEW; END IF;
  pid:=CASE WHEN TG_OP='DELETE' THEN OLD.id ELSE NEW.id END;
 ELSE
  IF TG_OP='UPDATE' AND (to_jsonb(OLD)-ARRAY['updated_at','updated_by'])=(to_jsonb(NEW)-ARRAY['updated_at','updated_by']) THEN RETURN NEW; END IF;
  pid:=CASE WHEN TG_OP='DELETE' THEN OLD.product_id ELSE NEW.product_id END;
  IF TG_OP='UPDATE' THEN oldpid:=OLD.product_id; END IF;
 END IF;
 IF pid IS NOT NULL THEN PERFORM public.ph2_capture(pid,TG_TABLE_NAME); END IF;
 IF oldpid IS NOT NULL AND oldpid<>pid THEN PERFORM public.ph2_capture(oldpid,TG_TABLE_NAME); END IF;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
REVOKE ALL ON FUNCTION public.ph2_change_trigger() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS ph_products_shadow_signal ON public.ph_products;
DROP TRIGGER IF EXISTS ph_product_channels_shadow_signal ON public.ph_product_channels;
CREATE TRIGGER ph2_product_changes AFTER INSERT OR UPDATE ON public.ph_products FOR EACH ROW EXECUTE FUNCTION public.ph2_change_trigger();
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['ph_media','ph_documents','ph_product_translations','ph_seo','ph_prices','ph_variants','ph_attribute_values','ph_marketing','ph_compliance','ph_product_channels'] LOOP
  EXECUTE format('CREATE TRIGGER ph2_content_changes AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.ph2_change_trigger()',t);
 END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.ph2_claim(_live boolean,_limit integer DEFAULT 10) RETURNS SETOF public.ph_sync_log LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE enabled boolean;
BEGIN
 IF _limit<1 OR _limit>20 THEN RAISE EXCEPTION 'Invalid limit'; END IF;
 IF _live THEN
  SELECT value @> '{"enabled":true,"backup_verified":true,"restore_verified":true,"communication_verified":true}'::jsonb AND length(coalesce(value->>'approved_by',''))>0 INTO enabled FROM public.ph_settings WHERE key='ph2_activation';
  IF NOT coalesce(enabled,false) THEN RETURN; END IF;
 END IF;
 UPDATE public.ph_sync_log l SET status='superseded',message='Veraltetes Ereignis; nicht erneut gesendet' WHERE l.operation='ph2_signal' AND l.status IN ('queued','queued_shadow','retry','awaiting_receipt','sending','preparing','failed','shadow') AND EXISTS(SELECT 1 FROM public.ph_sync_log n WHERE n.operation='ph2_signal' AND n.product_id=l.product_id AND n.channel_code=l.channel_code AND (n.payload->'signal'->>'version')>(l.payload->'signal'->>'version'));
 UPDATE public.ph_sync_log SET status='failed',message='Fünf Wiederholungen ausgeschöpft',payload=payload||jsonb_build_object('last_error',coalesce(payload->>'last_error','receipt_timeout'),'confirmation','unconfirmed') WHERE operation='ph2_signal' AND status IN ('retry','sending','awaiting_receipt') AND (payload->>'attempts')::integer>=6 AND coalesce((payload->>'lease_until')::timestamptz,'epoch')<=now() AND coalesce((payload->>'next_attempt_at')::timestamptz,'epoch')<=now();
 RETURN QUERY WITH due AS (
  SELECT id FROM public.ph_sync_log WHERE operation='ph2_signal'
   AND CASE WHEN _live THEN direction='outbound' AND status IN ('queued','retry','sending','awaiting_receipt') AND (payload->>'attempts')::integer<6 ELSE direction='shadow' AND status IN ('queued_shadow','preparing') END
   AND coalesce((payload->>'next_attempt_at')::timestamptz,'epoch')<=now()
   AND coalesce((payload->>'lease_until')::timestamptz,'epoch')<=now()
  ORDER BY created_at LIMIT _limit FOR UPDATE SKIP LOCKED
 ) UPDATE public.ph_sync_log l SET status=CASE WHEN _live THEN 'sending' ELSE 'preparing' END,
  payload=l.payload||jsonb_build_object('lease_token',gen_random_uuid(),'lease_until',now()+interval '90 seconds','attempts',(l.payload->>'attempts')::integer+CASE WHEN _live THEN 1 ELSE 0 END)
  FROM due WHERE l.id=due.id RETURNING l.*;
END $$;
REVOKE ALL ON FUNCTION public.ph2_claim(boolean,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ph2_claim(boolean,integer) TO service_role;

CREATE OR REPLACE FUNCTION public.ph2_finish(_id uuid,_lease uuid,_result jsonb) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE q public.ph_sync_log; attempts integer; delay integer; st text; next_at timestamptz;
BEGIN
 SELECT * INTO q FROM public.ph_sync_log WHERE id=_id AND operation='ph2_signal' FOR UPDATE;
 IF NOT FOUND OR q.payload->>'lease_token'<>_lease::text OR q.status NOT IN ('sending','preparing') THEN RETURN false; END IF;
 IF EXISTS(SELECT 1 FROM public.ph_sync_log n WHERE n.operation='ph2_signal' AND n.product_id=q.product_id AND n.channel_code=q.channel_code AND (n.payload->'signal'->>'version')>(q.payload->'signal'->>'version')) THEN
  UPDATE public.ph_sync_log SET status='superseded' WHERE id=q.id; RETURN false;
 END IF;
 IF _result->'signal'->>'event_id'<>q.payload->'signal'->>'event_id' OR _result->'signal'->>'version'<>q.payload->'signal'->>'version' OR _result->'signal'->>'desired' NOT IN ('ONLINE','OFFLINE') THEN RAISE EXCEPTION 'Invalid signal'; END IF;
 attempts:=(q.payload->>'attempts')::integer;
 delay:=CASE attempts WHEN 1 THEN 2 WHEN 2 THEN 10 WHEN 3 THEN 30 WHEN 4 THEN 120 WHEN 5 THEN 600 ELSE NULL END;
 IF q.direction='shadow' THEN st:='shadow';
 ELSIF (_result->>'ok')::boolean THEN st:='awaiting_receipt';
 ELSE st:=CASE WHEN delay IS NULL THEN 'failed' ELSE 'retry' END; END IF;
 next_at:=now()+make_interval(secs=>coalesce(delay,30));
 UPDATE public.ph_sync_log SET status=st,message=CASE WHEN st='shadow' THEN 'SHADOW MODE · nicht gesendet' WHEN st='awaiting_receipt' THEN 'Empfangen; Veröffentlichungsnachweis ausstehend' ELSE 'Übertragungsfehler; '||coalesce(_result->>'error','unbekannt') END,
  duration_ms=coalesce((_result->>'duration_ms')::integer,0),payload=(payload-'lease_token'-'lease_until')||_result||jsonb_build_object('next_attempt_at',next_at,'last_error',_result->>'error','confirmation','unconfirmed','transmitted_version',CASE WHEN q.direction='outbound' AND (_result->>'ok')::boolean THEN q.payload->'signal'->>'version' ELSE NULL END)
 WHERE id=q.id;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.ph2_finish(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ph2_finish(uuid,uuid,jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.ph2_receipt(_receipt jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE q public.ph_sync_log; st text; matching boolean;
BEGIN
 SELECT * INTO q FROM public.ph_sync_log WHERE operation='ph2_signal' AND payload->'signal'->>'event_id'=_receipt->>'event_id' FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('accepted',false,'status','unknown_event'); END IF;
 IF q.channel_code<>_receipt->>'channel' OR q.payload->'signal'->>'product_id'<>_receipt->>'product_id' OR q.payload->'signal'->>'version'<>_receipt->>'version' THEN RETURN jsonb_build_object('accepted',false,'status','identity_mismatch'); END IF;
 IF q.status='superseded' OR EXISTS(SELECT 1 FROM public.ph_sync_log n WHERE n.operation='ph2_signal' AND n.product_id=q.product_id AND n.channel_code=q.channel_code AND (n.payload->'signal'->>'version')>(q.payload->'signal'->>'version')) THEN RETURN jsonb_build_object('accepted',false,'status','stale'); END IF;
 IF q.direction<>'outbound' OR (q.payload->>'attempts')::integer=0 THEN RETURN jsonb_build_object('accepted',false,'status','not_transmitted'); END IF;
 IF q.status='website_confirmed' THEN RETURN jsonb_build_object('accepted',true,'duplicate',true,'confirmed',true,'status',q.status); END IF;
 IF _receipt->>'state' NOT IN ('ONLINE','OFFLINE','ERROR') THEN RAISE EXCEPTION 'Invalid receipt'; END IF;
 IF _receipt->>'state'='ONLINE' AND coalesce(_receipt->>'public_url','')='' THEN RETURN jsonb_build_object('accepted',false,'status','missing_public_url'); END IF;
 matching:=_receipt->>'state'=q.payload->'signal'->>'desired';
 st:=CASE WHEN matching THEN 'website_confirmed' WHEN _receipt->>'state'='ERROR' THEN 'website_error' ELSE 'website_mismatch' END;
 UPDATE public.ph_sync_log SET status=CASE WHEN matching THEN st WHEN (payload->>'attempts')::integer>=6 THEN 'failed' ELSE 'retry' END,
  message='Webseite meldet '||(_receipt->>'state'),payload=(payload-'lease_token'-'lease_until')||jsonb_build_object('receipt',_receipt,'confirmation',st,'last_error',CASE WHEN matching THEN NULL ELSE coalesce(_receipt->>'error','website_state_mismatch') END) WHERE id=q.id;
 RETURN jsonb_build_object('accepted',true,'confirmed',matching,'status',st);
END $$;
REVOKE ALL ON FUNCTION public.ph2_receipt(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ph2_receipt(jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.ph2_retry(_event_id uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE q public.ph_sync_log;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.user_profiles p JOIN public.user_roles ur ON ur.user_id=p.user_id JOIN public.roles r ON r.id=ur.role_id WHERE p.user_id=auth.uid() AND p.account_status='active' AND r.name='Super Admin') THEN RAISE EXCEPTION 'Nur aktive Super Admins'; END IF;
 SELECT * INTO q FROM public.ph_sync_log WHERE id=_event_id AND operation='ph2_signal' FOR UPDATE;
 IF NOT FOUND OR q.status<>'failed' THEN RETURN false; END IF;
 IF EXISTS(SELECT 1 FROM public.ph_sync_log n WHERE n.operation='ph2_signal' AND n.product_id=q.product_id AND n.channel_code=q.channel_code AND (n.payload->'signal'->>'version')>(q.payload->'signal'->>'version')) THEN RAISE EXCEPTION 'Veraltetes Ereignis'; END IF;
 UPDATE public.ph_sync_log SET status=CASE WHEN direction='shadow' THEN 'queued_shadow' ELSE 'queued' END,
  payload=(payload-'lease_token'-'lease_until')||jsonb_build_object('attempts',0,'next_attempt_at',now(),'manual_retry_by',auth.uid(),'previous_error',payload->>'last_error') WHERE id=q.id;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.ph2_retry(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ph2_retry(uuid) TO authenticated,service_role;
