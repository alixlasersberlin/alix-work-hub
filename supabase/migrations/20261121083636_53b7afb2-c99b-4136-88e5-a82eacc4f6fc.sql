DO $test$
DECLARE p public.ph_products%ROWTYPE; c public.ph_product_channels%ROWTYPE; actor uuid; req jsonb; reply jsonb; publication uuid:=gen_random_uuid();
BEGIN
 IF has_function_privilege('authenticated','public.ph_beauty_claim_release(uuid,jsonb)','EXECUTE') OR has_function_privilege('anon','public.ph_beauty_finish_release(uuid,uuid,jsonb,boolean)','EXECUTE') THEN RAISE EXCEPTION 'Beauty release must be service-only'; END IF;
 SELECT pc.* INTO STRICT c FROM public.ph_product_channels pc JOIN public.ph_products product ON product.id=pc.product_id WHERE pc.channel_code='beautyco' AND product.alix_product_id IS NOT NULL LIMIT 1;
 SELECT * INTO STRICT p FROM public.ph_products WHERE id=c.product_id;
 SELECT up.id INTO STRICT actor FROM public.user_profiles up JOIN public.user_roles ur ON ur.user_id=up.id JOIN public.roles r ON r.id=ur.role_id WHERE up.is_active AND up.account_status='active' AND r.name='Super Admin' LIMIT 1;
 BEGIN
  UPDATE public.ph_products SET status='published',active_de=true WHERE id=p.id;
  UPDATE public.ph_channels SET is_active=true WHERE code='beautyco';
  UPDATE public.ph_product_channels SET hold=false,status='published',remote_snapshot='{}' WHERE id=c.id;
  req:=jsonb_build_object('schema_version',1,'publication_id',publication,'hub_id',p.alix_product_id,'version',(SELECT updated_at::text FROM public.ph_products WHERE id=p.id),'channel','beautyco','country','DE','locale','de','target_origin','https://alix-beauty.com','approval',jsonb_build_object('actor_id',actor,'source','alixwork','role','Super Admin'));
  PERFORM public.ph_beauty_claim_release(p.id,req);
  BEGIN
   PERFORM public.ph_beauty_claim_release(p.id,req);
   RAISE EXCEPTION USING ERRCODE='ZX002',MESSAGE='Duplicate release accepted';
  EXCEPTION WHEN raise_exception THEN NULL; END;
  reply:=req||jsonb_build_object('ok',true,'online',true,'dry_run',false,'state','online','public_url','https://alix-beauty.com/beauty-geraete/synthetic-test','content_hash',repeat('a',64));
  BEGIN
   PERFORM public.ph_beauty_finish_release(p.id,publication,reply||jsonb_build_object('channel','de'),true);
   RAISE EXCEPTION USING ERRCODE='ZX002',MESSAGE='Wrong channel accepted';
  EXCEPTION WHEN raise_exception THEN NULL; END;
  UPDATE public.ph_product_channels SET hold=true WHERE id=c.id;
  BEGIN
   PERFORM public.ph_beauty_finish_release(p.id,publication,reply,true);
   RAISE EXCEPTION USING ERRCODE='ZX002',MESSAGE='Withheld release finalized';
  EXCEPTION WHEN raise_exception THEN NULL; END;
  UPDATE public.ph_product_channels SET hold=false WHERE id=c.id;
  PERFORM public.ph_beauty_finish_release(p.id,publication,reply,true);
  IF (SELECT remote_snapshot->'beauty_online'->>'version' FROM public.ph_product_channels WHERE id=c.id) IS DISTINCT FROM req->>'version' THEN RAISE EXCEPTION 'Exact ONLINE version not stored'; END IF;
  UPDATE public.ph_product_channels SET remote_snapshot=remote_snapshot||jsonb_build_object('beauty_offline',jsonb_build_object('offline',true)) WHERE id=c.id;
  BEGIN
   PERFORM public.ph_beauty_claim_release(p.id,req);
   RAISE EXCEPTION USING ERRCODE='ZX002',MESSAGE='Offline reactivation accepted';
  EXCEPTION WHEN raise_exception THEN NULL; END;
  RAISE EXCEPTION USING ERRCODE='ZX001',MESSAGE='rollback synthetic beauty release tests';
 EXCEPTION WHEN SQLSTATE 'ZX001' THEN NULL; END;
 IF (SELECT to_jsonb(pc) FROM public.ph_product_channels pc WHERE id=c.id) IS DISTINCT FROM to_jsonb(c) OR (SELECT to_jsonb(product) FROM public.ph_products product WHERE id=p.id) IS DISTINCT FROM to_jsonb(p) THEN RAISE EXCEPTION 'Tests not rolled back'; END IF;
 RAISE NOTICE 'PASS Beauty release: service-only, reservation, duplicate, channel, withholding, exact proof, offline gate; all writes rolled back';
END $test$;