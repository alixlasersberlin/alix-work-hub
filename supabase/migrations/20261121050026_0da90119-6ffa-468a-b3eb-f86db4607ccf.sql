DO $test$
DECLARE c public.ph_product_channels%ROWTYPE; hub text; actor uuid; req jsonb; reply jsonb; operation uuid:=gen_random_uuid(); decision text;
BEGIN
 IF has_function_privilege('authenticated','public.ph_beauty_claim_offline(uuid,jsonb)','EXECUTE') OR has_function_privilege('anon','public.ph_beauty_finish_offline(uuid,uuid,jsonb,boolean)','EXECUTE') THEN RAISE EXCEPTION 'Beauty-Funktionen nicht service-only'; END IF;
 SELECT pc.* INTO STRICT c FROM public.ph_product_channels pc JOIN public.ph_products p ON p.id=pc.product_id WHERE pc.channel_code='beautyco' AND p.alix_product_id IS NOT NULL LIMIT 1;
 SELECT alix_product_id INTO hub FROM public.ph_products WHERE id=c.product_id;
 SELECT up.id INTO STRICT actor FROM public.user_profiles up JOIN public.user_roles ur ON ur.user_id=up.id JOIN public.roles r ON r.id=ur.role_id WHERE up.is_active AND up.account_status='active' AND r.name='Super Admin' LIMIT 1;
 BEGIN
  UPDATE public.ph_product_channels SET hold=true,remote_snapshot='{}' WHERE id=c.id;
  SELECT updated_at::text INTO decision FROM public.ph_product_channels WHERE id=c.id;
  req:=jsonb_build_object('action','deactivate','operation_id',operation,'hub_id',hub,'channel','beautyco','target_origin','https://alix-beauty.com','version',decision,'expected_version','2000-01-01T00:00:00Z','approval',jsonb_build_object('actor_id',actor));
  BEGIN
   PERFORM public.ph_beauty_claim_offline(c.product_id,req);
   RAISE EXCEPTION USING ERRCODE='ZX002',MESSAGE='Fehlender ONLINE-Nachweis akzeptiert';
  EXCEPTION WHEN raise_exception THEN NULL;
  END;
  UPDATE public.ph_product_channels SET remote_snapshot=jsonb_build_object('beauty_online',jsonb_build_object('ok',true,'online',true,'state','online','hub_id',hub,'channel','beautyco','version','2000-01-01T00:00:00Z')) WHERE id=c.id;
  SELECT updated_at::text INTO decision FROM public.ph_product_channels WHERE id=c.id;
  req:=req||jsonb_build_object('version',decision);
  PERFORM public.ph_beauty_claim_offline(c.product_id,req);
  BEGIN
   PERFORM public.ph_beauty_claim_offline(c.product_id,req);
   RAISE EXCEPTION USING ERRCODE='ZX002',MESSAGE='Doppelter Auftrag akzeptiert';
  EXCEPTION WHEN raise_exception THEN NULL;
  END;
  reply:=jsonb_build_object('ok',true,'offline',true,'online',false,'dry_run',false,'state','OFFLINE','operation_id',operation,'hub_id',hub,'channel','beautyco','version',decision,'verification',jsonb_build_object('public_url','https://alix-beauty.com/beauty-geraete/synthetic-test','detail_status',404,'catalog_visible',false,'search_visible',false));
  BEGIN
   PERFORM public.ph_beauty_finish_offline(c.product_id,operation,reply||jsonb_build_object('version','wrong'),true);
   RAISE EXCEPTION USING ERRCODE='ZX002',MESSAGE='Falsche Version akzeptiert';
  EXCEPTION WHEN raise_exception THEN NULL;
  END;
  PERFORM public.ph_beauty_finish_offline(c.product_id,operation,reply,true);
  IF (SELECT remote_snapshot->'beauty_offline'->>'operation_id' FROM public.ph_product_channels WHERE id=c.id) IS DISTINCT FROM operation::text THEN RAISE EXCEPTION 'Abschluss fehlt'; END IF;
  RAISE EXCEPTION USING ERRCODE='ZX001',MESSAGE='rollback synthetic beauty tests';
 EXCEPTION WHEN SQLSTATE 'ZX001' THEN NULL;
 END;
 IF (SELECT to_jsonb(pc) FROM public.ph_product_channels pc WHERE id=c.id) IS DISTINCT FROM to_jsonb(c) THEN RAISE EXCEPTION 'Test nicht zurückgenommen'; END IF;
 RAISE NOTICE 'PASS Beauty: service-only, missing proof, reservation, duplicate, version, finish; all synthetic writes rolled back';
END $test$;