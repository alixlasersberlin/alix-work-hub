-- Privileged test runner. No network calls; every reservation is rolled back.
DO $qa$
DECLARE actor uuid; product public.ph_products%ROWTYPE; map public.ph_lang_sync_map%ROWTYPE;
 release jsonb; reply jsonb; snapshot jsonb; publish_id uuid:=gen_random_uuid();
BEGIN
 IF has_function_privilege('anon','public.ph_global_claim_release(uuid,text,jsonb)','EXECUTE')
 OR has_function_privilege('authenticated','public.ph_global_claim_release(uuid,text,jsonb)','EXECUTE')
 OR has_function_privilege('authenticated','public.ph_global_finish_release(uuid,text,uuid,jsonb,boolean)','EXECUTE') THEN RAISE EXCEPTION 'Service-only RPC offen'; END IF;
 SELECT up.id INTO actor FROM public.user_profiles up JOIN public.user_roles ur ON ur.user_id=up.id JOIN public.roles r ON r.id=ur.role_id WHERE up.is_active AND up.account_status='active' AND r.name='Super Admin' LIMIT 1;
 SELECT * INTO product FROM public.ph_products WHERE alix_product_id='82efb1d3-0100-22e6-83ef-933583efd4b9';
 SELECT * INTO map FROM public.ph_lang_sync_map WHERE product_id=product.id AND site_code='de';
 IF actor IS NULL OR product.id IS NULL OR map.verified_at IS NULL THEN RAISE EXCEPTION 'Hifu-Pro-Testidentität fehlt'; END IF;
 SELECT remote_snapshot INTO snapshot FROM public.ph_product_channels WHERE product_id=product.id AND channel_code='de';
 release:=jsonb_build_object('publish_id',publish_id,'hub_id',product.alix_product_id,'product_id',map.remote_product_id,'channel','de','source_version','QA synthetic only','expected_version',snapshot->'global_direct'->>'source_version','approval',jsonb_build_object('actor_id',actor));
 BEGIN
  PERFORM public.ph_global_claim_release(product.id,'de',release);
  BEGIN
   PERFORM public.ph_global_claim_release(product.id,'de',release||jsonb_build_object('publish_id',gen_random_uuid()));
   RAISE EXCEPTION 'Doppelte Reservierung akzeptiert';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Vorherige GLOBAL-Freigabe%' THEN RAISE; END IF; END;
  reply:=release||jsonb_build_object('status','WRITE_READY','online',false,'ok',true,'public_url','https://alix-lasers.de/produkte/hifu-pro');
  BEGIN
   PERFORM public.ph_global_finish_release(product.id,'de',publish_id,reply,true);
   RAISE EXCEPTION 'Probelauf als online akzeptiert';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'Online-Nachweis unvollständig' THEN RAISE; END IF; END;
  reply:=reply||jsonb_build_object('status','ONLINE','online',true);
  PERFORM public.ph_global_finish_release(product.id,'de',publish_id,reply,true);
  IF NOT EXISTS(SELECT 1 FROM public.ph_product_channels WHERE product_id=product.id AND channel_code='de' AND remote_snapshot->'global_pending' IS NULL AND live_version='QA synthetic only' AND live_url='https://alix-lasers.de/produkte/hifu-pro') THEN RAISE EXCEPTION 'Bestätigte Version nicht gespeichert'; END IF;
  IF (to_jsonb(product) IS DISTINCT FROM (SELECT to_jsonb(p) FROM public.ph_products p WHERE id=product.id)) THEN RAISE EXCEPTION 'Produkt/Preise verändert'; END IF;
  RAISE EXCEPTION 'QA_ROLLBACK' USING ERRCODE='P0002';
 EXCEPTION WHEN SQLSTATE 'P0002' THEN IF SQLERRM<>'QA_ROLLBACK' THEN RAISE; END IF; END;
 IF EXISTS(SELECT 1 FROM public.ph_sync_log WHERE operation='global_direct_release' AND payload->'release'->>'publish_id'=publish_id::text) THEN RAISE EXCEPTION 'Test nicht zurückgenommen'; END IF;
 RAISE NOTICE 'PASS: service-only, confirmed DE identity, duplicate reservation, dry-run exclusion, version storage, unchanged product/prices, rollback';
END $qa$;