DO $test$
DECLARE p public.ph_products%ROWTYPE; actor uuid; remote_id uuid:=gen_random_uuid(); operation_id uuid:=gen_random_uuid(); req jsonb; envelope jsonb; reply jsonb;
BEGIN
 IF has_function_privilege('authenticated','public.ph_ae_claim_operation(uuid,jsonb)','EXECUTE') OR has_function_privilege('anon','public.ph_ae_finish_operation(uuid,uuid,jsonb,boolean)','EXECUTE') THEN RAISE EXCEPTION 'AE operations must be service-only'; END IF;
 SELECT * INTO STRICT p FROM public.ph_products WHERE alix_product_id IS NOT NULL LIMIT 1;
 SELECT up.id INTO STRICT actor FROM public.user_profiles up JOIN public.user_roles ur ON ur.user_id=up.id JOIN public.roles r ON r.id=ur.role_id WHERE up.is_active AND up.account_status='active' AND r.name='Super Admin' LIMIT 1;
 BEGIN
  UPDATE public.ph_products SET active_dubai=false WHERE id=p.id;
  UPDATE public.ph_channels SET is_active=true WHERE code='dubai';
  INSERT INTO public.ph_product_channels(product_id,channel_code,hold,remote_snapshot) VALUES(p.id,'dubai',true,'{}') ON CONFLICT(product_id,channel_code) DO UPDATE SET hold=true,remote_snapshot='{}';
  req:=jsonb_build_object('action','deactivate','operation_id',operation_id,'source_version','ae:'||operation_id,'expected_version',null,'reason','withheld','product_id',remote_id,'hub_id',p.alix_product_id,'channel','dubai','approval',jsonb_build_object('actor_id',actor,'role','super_admin','active',true,'channel','dubai','hub_id',p.alix_product_id,'source_version','ae:'||operation_id));
  envelope:=jsonb_build_object('request',req,'product_updated_at',(SELECT updated_at::text FROM public.ph_products WHERE id=p.id));
  BEGIN
   PERFORM public.ph_ae_claim_operation(p.id,envelope);
   RAISE EXCEPTION USING ERRCODE='ZX002',MESSAGE='Unconfirmed AE mapping accepted';
  EXCEPTION WHEN raise_exception THEN NULL; END;
  INSERT INTO public.ph_lang_sync_map(product_id,site_code,remote_product_id,verified_at) VALUES(p.id,'dubai',remote_id::text,now()) ON CONFLICT(product_id,site_code) DO UPDATE SET remote_product_id=remote_id::text,verified_at=now();
  PERFORM public.ph_ae_claim_operation(p.id,envelope);
  BEGIN
   PERFORM public.ph_ae_claim_operation(p.id,envelope);
   RAISE EXCEPTION USING ERRCODE='ZX002',MESSAGE='Duplicate AE reservation accepted';
  EXCEPTION WHEN raise_exception THEN NULL; END;
  reply:=req||jsonb_build_object('ok',true,'offline',true,'status','OFFLINE','public_urls',jsonb_build_array('https://alix-lasers.ae/systems/synthetic-test','https://alix-lasers.ae/ar/systems/synthetic-test'));
  BEGIN
   PERFORM public.ph_ae_finish_operation(p.id,operation_id,reply||jsonb_build_object('product_id',gen_random_uuid()),true);
   RAISE EXCEPTION USING ERRCODE='ZX002',MESSAGE='Foreign AE identity accepted';
  EXCEPTION WHEN raise_exception THEN NULL; END;
  PERFORM public.ph_ae_finish_operation(p.id,operation_id,reply,true);
  IF (SELECT remote_snapshot->'ae_direct'->>'status' FROM public.ph_product_channels WHERE product_id=p.id AND channel_code='dubai') IS DISTINCT FROM 'OFFLINE' THEN RAISE EXCEPTION 'OFFLINE proof missing'; END IF;
  UPDATE public.ph_products SET active_dubai=true,status='published' WHERE id=p.id;
  UPDATE public.ph_product_channels SET hold=false WHERE product_id=p.id AND channel_code='dubai';
  req:=req||jsonb_build_object('action','publish','publish_id',gen_random_uuid(),'expected_version',req->>'source_version','source_version','ae:new');
  req:=req||jsonb_build_object('approval',(req->'approval')||jsonb_build_object('source_version','ae:new'));
  envelope:=envelope||jsonb_build_object('request',req,'product_updated_at',(SELECT updated_at::text FROM public.ph_products WHERE id=p.id));
  BEGIN
   PERFORM public.ph_ae_claim_operation(p.id,envelope);
   RAISE EXCEPTION USING ERRCODE='ZX002',MESSAGE='Publish bypassed AE offline lock';
  EXCEPTION WHEN raise_exception THEN NULL; END;
  operation_id:=gen_random_uuid();
  req:=(req-'publish_id'-'reason')||jsonb_build_object('action','reactivate','operation_id',operation_id,'source_version','ae:'||operation_id);
  req:=req||jsonb_build_object('approval',(req->'approval')||jsonb_build_object('source_version',req->>'source_version','reactivate',true));
  envelope:=envelope||jsonb_build_object('request',req);
  PERFORM public.ph_ae_claim_operation(p.id,envelope);
  reply:=req||jsonb_build_object('ok',true,'online',true,'status','ONLINE','public_url','https://alix-lasers.ae/systems/synthetic-test','public_urls',jsonb_build_array('https://alix-lasers.ae/systems/synthetic-test','https://alix-lasers.ae/ar/systems/synthetic-test'));
  PERFORM public.ph_ae_finish_operation(p.id,operation_id,reply,true);
  IF (SELECT remote_snapshot->'ae_direct'->>'source_version' FROM public.ph_product_channels WHERE product_id=p.id AND channel_code='dubai') IS DISTINCT FROM req->>'source_version' THEN RAISE EXCEPTION 'Reactivation version missing'; END IF;
  RAISE EXCEPTION USING ERRCODE='ZX001',MESSAGE='rollback synthetic AE tests';
 EXCEPTION WHEN SQLSTATE 'ZX001' THEN NULL; END;
 IF (SELECT to_jsonb(product) FROM public.ph_products product WHERE id=p.id) IS DISTINCT FROM to_jsonb(p) THEN RAISE EXCEPTION 'AE tests not rolled back'; END IF;
 RAISE NOTICE 'PASS AE service-only, mapping, duplicate, identity, offline lock and explicit reactivation; all synthetic changes rolled back';
END $test$;