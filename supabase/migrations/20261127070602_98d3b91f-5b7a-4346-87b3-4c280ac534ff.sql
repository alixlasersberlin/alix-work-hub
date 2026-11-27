CREATE FUNCTION public.ph2_prepare(_id uuid,_lease uuid,_signal jsonb,_decision jsonb) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE q public.ph_sync_log;
BEGIN
 SELECT * INTO q FROM public.ph_sync_log WHERE id=_id AND operation='ph2_signal' FOR UPDATE;
 IF NOT FOUND OR q.payload->>'lease_token'<>_lease::text OR q.status NOT IN ('sending','preparing') THEN RETURN false; END IF;
 IF _signal->>'event_id'<>q.payload->'signal'->>'event_id' OR _signal->>'version'<>q.payload->'signal'->>'version' OR _signal->>'channel'<>q.channel_code OR _signal->>'product_id'<>q.payload->'signal'->>'product_id' OR coalesce(_signal->>'desired','') NOT IN ('ONLINE','OFFLINE') THEN RAISE EXCEPTION 'Invalid prepared signal'; END IF;
 IF EXISTS(SELECT 1 FROM public.ph_sync_log n WHERE n.operation='ph2_signal' AND n.product_id=q.product_id AND n.channel_code=q.channel_code AND (n.payload->'signal'->>'version')>(q.payload->'signal'->>'version')) THEN RETURN false; END IF;
 UPDATE public.ph_sync_log SET payload=payload||jsonb_build_object('signal',_signal,'decision',_decision) WHERE id=q.id;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.ph2_prepare(uuid,uuid,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ph2_prepare(uuid,uuid,jsonb,jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.ph2_wake() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE credential text;
BEGIN
 IF NEW.operation<>'ph2_signal' OR NEW.status NOT IN ('queued','queued_shadow') THEN RETURN NEW; END IF;
 BEGIN
  SELECT decrypted_secret INTO credential FROM vault.decrypted_secrets WHERE name='CRON_SECRET' LIMIT 1;
  IF credential IS NOT NULL THEN
   PERFORM net.http_post(url:='https://xmrmkgfgpoundfwhnxfs.supabase.co/functions/v1/ph-signal-dispatch',headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||credential),body:='{"limit":10}'::jsonb);
  END IF;
 EXCEPTION WHEN OTHERS THEN NULL; -- durable row remains; dispatcher/recovery can resume later
 END;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.ph2_wake() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER ph2_queue_wake AFTER INSERT ON public.ph_sync_log FOR EACH ROW EXECUTE FUNCTION public.ph2_wake();

DO $tests$
DECLARE ev uuid:=gen_random_uuid(); pid uuid:=gen_random_uuid(); s jsonb; q public.ph_sync_log; result jsonb; n integer;
BEGIN
 BEGIN
  s:=jsonb_build_object('event','product.changed','event_id',ev,'product_id','isolated-test','channel','de','version','2099-01-01T00:00:00.000001Z','desired','ONLINE','issued_at','2099-01-01T00:00:00Z');
  INSERT INTO public.ph_sync_log(id,product_id,channel_code,direction,operation,status,payload) VALUES(ev,pid,'de','shadow','ph2_signal','preparing',jsonb_build_object('signal',s,'attempts',0,'next_attempt_at',now(),'lease_until',now()-interval '1 second','lease_token',gen_random_uuid()));
  SELECT * INTO q FROM public.ph2_claim(false,20) WHERE id=ev;
  IF q.id IS NULL OR q.status<>'preparing' THEN RAISE EXCEPTION 'restart recovery failed'; END IF;
  SELECT count(*) INTO n FROM public.ph2_claim(false,20) WHERE id=ev;
  IF n<>0 THEN RAISE EXCEPTION 'overlapping claim'; END IF;
  IF public.ph2_finish(ev,gen_random_uuid(),jsonb_build_object('signal',s,'ok',true)) THEN RAISE EXCEPTION 'old lease accepted'; END IF;
  IF NOT public.ph2_prepare(ev,(q.payload->>'lease_token')::uuid,s,'{}') THEN RAISE EXCEPTION 'prepare failed'; END IF;
  IF NOT public.ph2_finish(ev,(q.payload->>'lease_token')::uuid,jsonb_build_object('signal',s,'ok',true)) THEN RAISE EXCEPTION 'finish failed'; END IF;
  SELECT status INTO q.status FROM public.ph_sync_log WHERE id=ev;
  IF q.status<>'shadow' THEN RAISE EXCEPTION 'shadow unexpectedly sent'; END IF;
  result:=public.ph2_receipt(s||'{"state":"ONLINE","public_url":"https://alix-lasers.de/devices/test"}');
  IF result->>'status'<>'not_transmitted' THEN RAISE EXCEPTION 'unsent confirmed'; END IF;
  UPDATE public.ph_sync_log SET direction='outbound',status='sending',payload=payload||'{"attempts":1}' WHERE id=ev;
  result:=public.ph2_receipt(s||'{"state":"ONLINE","public_url":"https://alix-lasers.de/devices/test"}');
  IF result->>'confirmed'<>'true' THEN RAISE EXCEPTION 'valid receipt failed'; END IF;
  IF public.ph2_finish(ev,(q.payload->>'lease_token')::uuid,jsonb_build_object('signal',s,'ok',true)) THEN RAISE EXCEPTION 'early receipt overwritten'; END IF;
  result:=public.ph2_receipt(s||'{"state":"ONLINE","public_url":"https://alix-lasers.de/devices/test"}');
  IF result->>'duplicate'<>'true' THEN RAISE EXCEPTION 'receipt dedup failed'; END IF;
  ev:=gen_random_uuid(); s:=s||jsonb_build_object('event_id',ev,'version','2099-01-01T00:00:00.000002Z');
  INSERT INTO public.ph_sync_log(id,product_id,channel_code,direction,operation,status,payload) VALUES(ev,pid,'de','shadow','ph2_signal','preparing',jsonb_build_object('signal',s,'attempts',0,'lease_token',gen_random_uuid()));
  result:=public.ph2_receipt((s||jsonb_build_object('event_id',(SELECT payload->'signal'->>'event_id' FROM public.ph_sync_log WHERE product_id=pid ORDER BY payload->'signal'->>'version' LIMIT 1),'version','2099-01-01T00:00:00.000001Z'))||'{"state":"ONLINE","public_url":"https://alix-lasers.de/devices/test"}');
  IF result->>'status'<>'stale' THEN RAISE EXCEPTION 'stale receipt accepted'; END IF;
  IF EXISTS(SELECT 1 FROM public.ph2_claim(true,20)) THEN RAISE EXCEPTION 'live gate open'; END IF;
  RAISE EXCEPTION 'PH2_TEST_ROLLBACK';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM<>'PH2_TEST_ROLLBACK' THEN RAISE; END IF;
 END;
 IF EXISTS(SELECT 1 FROM public.ph_sync_log WHERE product_id=pid) THEN RAISE EXCEPTION 'fixture leaked'; END IF;
END $tests$;
