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
  SELECT coalesce(bool_or(hold),false) INTO held FROM public.ph_product_channels WHERE product_id=p.id AND CASE lower(trim(channel_code)) WHEN 'ae' THEN 'dubai' WHEN 'uae' THEN 'dubai' WHEN 'global' THEN 'com' ELSE lower(trim(channel_code)) END=ch;
  SELECT * INTO prev FROM public.ph_sync_log WHERE operation='ph2_signal' AND product_id=p.id AND channel_code=ch ORDER BY (payload->'signal'->>'version') DESC,id DESC LIMIT 1;
  IF prev.id IS NOT NULL AND prev.payload->>'txid'=txid_current()::text AND prev.status IN ('queued','queued_shadow') THEN
   UPDATE public.ph_sync_log SET payload=payload||jsonb_build_object('snapshot',snapshot,'hold',held,'source',_source) WHERE id=prev.id;
   CONTINUE;
  END IF;
  ev:=gen_random_uuid();
  v:=to_char(greatest(clock_timestamp(),coalesce((prev.payload->'signal'->>'version')::timestamptz,'epoch')+interval '1 microsecond') AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"');
  UPDATE public.ph_sync_log SET status='superseded',message='Durch neuere Produktversion ersetzt' WHERE operation='ph2_signal' AND product_id=p.id AND channel_code=ch AND status NOT IN ('superseded','website_confirmed');
  INSERT INTO public.ph_sync_log(id,created_at,product_id,channel_code,direction,operation,status,message,payload) VALUES
   (ev,clock_timestamp(),p.id,ch,CASE WHEN active THEN 'outbound' ELSE 'shadow' END,'ph2_signal',CASE WHEN active THEN 'queued' ELSE 'queued_shadow' END,'Änderung dauerhaft erfasst; Entscheidung ausstehend',
    jsonb_build_object('signal',jsonb_build_object('event','product.changed','event_id',ev,'product_id',coalesce(nullif(p.alix_product_id,''),p.id::text),'channel',ch,'version',v,'desired',null,'issued_at',v),'snapshot',snapshot,'hold',held,'source',_source,'attempts',0,'next_attempt_at',now(),'last_error',null,'confirmation','unknown','txid',txid_current()::text,'shadow_mode',NOT coalesce(active,false)));
 END LOOP;
END $$;
DROP TRIGGER ph2_queue_wake ON public.ph_sync_log;
CREATE TRIGGER ph2_queue_wake AFTER INSERT OR UPDATE OF status ON public.ph_sync_log FOR EACH ROW EXECUTE FUNCTION public.ph2_wake();
CREATE INDEX IF NOT EXISTS ph2_queue_version ON public.ph_sync_log (product_id,channel_code,(payload->'signal'->>'version') DESC) WHERE operation='ph2_signal';