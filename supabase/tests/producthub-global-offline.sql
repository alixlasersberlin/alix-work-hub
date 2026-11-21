DO $test$
DECLARE p public.ph_products%ROWTYPE; m public.ph_lang_sync_map%ROWTYPE; actor uuid; req jsonb; reply jsonb; operation uuid:=gen_random_uuid(); unchanged jsonb; final_state jsonb;
BEGIN
 IF has_function_privilege('anon','public.ph_global_claim_offline(uuid,text,jsonb)','EXECUTE') OR has_function_privilege('authenticated','public.ph_global_claim_offline(uuid,text,jsonb)','EXECUTE') OR has_function_privilege('authenticated','public.ph_global_finish_offline(uuid,text,uuid,jsonb,boolean)','EXECUTE') THEN RAISE EXCEPTION 'Abschaltfunktionen nicht service-only'; END IF;
 SELECT pp.* INTO STRICT p FROM public.ph_products pp JOIN public.ph_lang_sync_map mm ON mm.product_id=pp.id WHERE mm.site_code='com' AND mm.verified_at IS NOT NULL AND pp.alix_product_id IS NOT NULL LIMIT 1;
 SELECT * INTO STRICT m FROM public.ph_lang_sync_map WHERE product_id=p.id AND site_code='com';
 SELECT up.id INTO STRICT actor FROM public.user_profiles up JOIN public.user_roles ur ON ur.user_id=up.id JOIN public.roles r ON r.id=ur.role_id WHERE up.is_active AND up.account_status='active' AND r.name='Super Admin' LIMIT 1;
 unchanged:=to_jsonb(p)-'active_com'-'updated_at'-'updated_by';
 BEGIN
  UPDATE public.ph_products SET active_com=false WHERE id=p.id;
  INSERT INTO public.ph_product_channels(product_id,channel_code) VALUES(p.id,'com') ON CONFLICT(product_id,channel_code) DO NOTHING;
  UPDATE public.ph_product_channels SET remote_snapshot='{}',hold=true WHERE product_id=p.id AND channel_code='com';
  req:=jsonb_build_object('action','deactivate','operation_id',operation,'hub_id',p.alix_product_id,'product_id',m.remote_product_id,'channel','com','source_version','offline:'||operation,'expected_version',null,'reason','inactive','dry_run',true,'approval',jsonb_build_object('actor_id',actor,'role','super_admin','active',true,'channel','com','hub_id',p.alix_product_id,'source_version','offline:'||operation));
  BEGIN
   PERFORM public.ph_global_claim_offline(p.id,'com',jsonb_set(req,'{approval,actor_id}',to_jsonb(gen_random_uuid()::text)));
   RAISE EXCEPTION USING ERRCODE='ZX002',MESSAGE='Nichtadmin akzeptiert';
  EXCEPTION WHEN raise_exception THEN NULL;
  END;
  BEGIN
   PERFORM public.ph_global_claim_offline(p.id,'com',req||jsonb_build_object('expected_version','wrong'));
   RAISE EXCEPTION USING ERRCODE='ZX002',MESSAGE='Falsche Version akzeptiert';
  EXCEPTION WHEN raise_exception THEN NULL;
  END;
  PERFORM public.ph_global_claim_offline(p.id,'com',req);
  BEGIN
   PERFORM public.ph_global_claim_offline(p.id,'com',req||jsonb_build_object('operation_id',gen_random_uuid()));
   RAISE EXCEPTION USING ERRCODE='ZX002',MESSAGE='Doppelte Abschaltung akzeptiert';
  EXCEPTION WHEN raise_exception THEN NULL;
  END;
  reply:=(req-'action'-'approval'-'reason'-'expected_version'-'dry_run')||jsonb_build_object('ok',true,'offline',true,'status','OFFLINE','public_urls',jsonb_build_array('https://www.alix-lasers.com/devices/synthetic-test'));
  BEGIN
   PERFORM public.ph_global_finish_offline(p.id,'com',operation,reply||jsonb_build_object('product_id',gen_random_uuid()),true);
   RAISE EXCEPTION USING ERRCODE='ZX002',MESSAGE='Fremder Gerätebeleg akzeptiert';
  EXCEPTION WHEN raise_exception THEN NULL;
  END;
  PERFORM public.ph_global_finish_offline(p.id,'com',operation,reply,true);
  SELECT remote_snapshot INTO final_state FROM public.ph_product_channels WHERE product_id=p.id AND channel_code='com';
  IF final_state->'global_offline'->>'operation_id' IS DISTINCT FROM operation::text OR final_state->'global_offline_pending' IS NOT NULL THEN RAISE EXCEPTION 'Abschluss falsch'; END IF;
  IF (SELECT to_jsonb(pp)-'active_com'-'updated_at'-'updated_by' FROM public.ph_products pp WHERE pp.id=p.id) IS DISTINCT FROM unchanged THEN RAISE EXCEPTION 'Originalinhalte/Preise/andere Länder verändert'; END IF;
  -- Even if an in-flight publish returns ONLINE, it cannot override deactivation.
  UPDATE public.ph_product_channels SET remote_snapshot=remote_snapshot||jsonb_build_object('global_pending',jsonb_build_object('publish_id',operation)) WHERE product_id=p.id AND channel_code='com';
  BEGIN
   PERFORM public.ph_global_finish_release(p.id,'com',operation,'{}',true);
   RAISE EXCEPTION USING ERRCODE='ZX002',MESSAGE='Veraltete ONLINE-Antwort nach Abschaltung akzeptiert';
  EXCEPTION WHEN raise_exception THEN NULL;
  END;
  RAISE EXCEPTION USING ERRCODE='ZX001',MESSAGE='rollback successful offline tests';
 EXCEPTION WHEN SQLSTATE 'ZX001' THEN NULL;
 END;
 IF (SELECT to_jsonb(pp) FROM public.ph_products pp WHERE pp.id=p.id) IS DISTINCT FROM to_jsonb(p) THEN RAISE EXCEPTION 'Testprodukt nicht vollständig zurückgenommen'; END IF;
 RAISE NOTICE 'PASS: service-only, actor, version, duplicate, identity, finish, immutable content, stale ONLINE; all writes rolled back';
END $test$;