DO $$
DECLARE v record; m public.ph_lang_sync_map%ROWTYPE; c public.ph_product_channels%ROWTYPE; snapshot jsonb; old_mapping jsonb;
BEGIN
 LOCK TABLE public.ph_lang_sync_map IN SHARE ROW EXCLUSIVE MODE;
 FOR v IN SELECT * FROM (VALUES
 ('7110c16c-c17e-4002-a537-62ab2d9dec69'::uuid,'ALIX G15 PRO','13914134-4b95-4f3f-a064-71f725c7d987'),
 ('4d449ebe-3fa0-4bac-ae67-c2ee08cf7993'::uuid,'Alix Luxe','13914134-4b95-4f3f-a064-71f725c7d222'),
 ('d6f92cfd-9031-4ab3-94cb-e2a829abf2f4'::uuid,'Alix O2','13914134-4b95-4f3f-a064-71f725c7d777'),
 ('acaeda93-946d-41ec-a7e7-809bf628ec5c'::uuid,'Alix Secret Twin OF','13914134-4b95-4f3f-a064-71f725c7d666'),
 ('d6775fb7-5de5-4ab4-b126-e2577b5e4a1d'::uuid,'BodyGlow','13914134-4b95-4f3f-a064-71f725c7d112')
 ) AS targets(product_id,name,remote_id) LOOP
  PERFORM 1 FROM public.ph_products WHERE id=v.product_id AND btrim(name)=v.name FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Eigener Artikel nicht eindeutig bestätigt: %',v.name; END IF;
  IF EXISTS(SELECT 1 FROM public.ph_lang_sync_map WHERE site_code='com' AND remote_product_id=v.remote_id AND product_id<>v.product_id) THEN RAISE EXCEPTION 'COM-Kennung bereits anderem Artikel zugeordnet: %',v.name; END IF;
  SELECT * INTO c FROM public.ph_product_channels WHERE product_id=v.product_id AND channel_code='com' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bestehender COM-Kanal fehlt: %',v.name; END IF;
  snapshot:=coalesce(c.remote_snapshot,'{}'::jsonb);
  IF snapshot->'global_pending' IS NOT NULL OR snapshot->'global_offline_pending' IS NOT NULL THEN RAISE EXCEPTION 'Unklarer Versand muss zuerst geprüft werden: %',v.name; END IF;
  SELECT * INTO m FROM public.ph_lang_sync_map WHERE product_id=v.product_id AND site_code='com' FOR UPDATE;
  old_mapping:=CASE WHEN FOUND THEN to_jsonb(m) ELSE NULL END;
  INSERT INTO public.ph_sync_log(product_id,channel_code,direction,operation,status,payload)
  VALUES(v.product_id,'com','internal','com_mapping_confirmation','ok',jsonb_build_object('source','explicit_user_confirmation_2026_11_22','previous_mapping',old_mapping,'previous_remote_snapshot',snapshot,'confirmed_remote_product_id',v.remote_id));
  IF m.id IS NULL THEN
   INSERT INTO public.ph_lang_sync_map(product_id,site_code,remote_product_id,verified_at,note)
   VALUES(v.product_id,'com',v.remote_id,now(),'COM-Kennung ausdrücklich vom Nutzer am 22.11.2026 bestätigt: '||v.remote_id);
  ELSE
   UPDATE public.ph_lang_sync_map SET remote_product_id=v.remote_id,remote_url=CASE WHEN remote_product_id=v.remote_id THEN remote_url ELSE NULL END,verified_at=now(),updated_at=now(),note=concat_ws(E'\n',note,'COM-Kennung ausdrücklich vom Nutzer am 22.11.2026 bestätigt: '||v.remote_id) WHERE id=m.id;
  END IF;
  IF m.remote_product_id IS DISTINCT FROM v.remote_id THEN
   UPDATE public.ph_product_channels SET remote_snapshot=(snapshot-'global_offline'-'global_direct') || jsonb_build_object('previous_com_identity',jsonb_build_object('remote_product_id',m.remote_product_id,'remote_snapshot',snapshot,'archived_at',now())),has_pending_changes=true WHERE id=c.id;
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.ph_lang_sync_map WHERE product_id=v.product_id AND site_code='com' AND remote_product_id=v.remote_id AND verified_at IS NOT NULL) THEN RAISE EXCEPTION 'Bestätigte Zuordnung nicht gespeichert: %',v.name; END IF;
 END LOOP;
END $$;