DO $$
DECLARE v record; p public.ph_products%ROWTYPE; n integer:=0;
BEGIN
 FOR v IN SELECT * FROM (VALUES
 ('b0de3d8e-0100-51fb-b1de-6c75b1de8f89','9f083420-e078-49f2-b72d-1c9ddcf945bb'),
 ('9b8c79a1-0100-a0e3-9a8c-d9429c8d1a84','d4b1dbcc-70f0-4c18-8762-a9623b776504'),
 ('bf9a46a9-0100-9f2e-be9a-d987c09ae5d7','241035d7-ff01-4af3-bbc9-6a6ed7864e7a'),
 ('475621fc-0100-3795-4656-166948565991','53048f98-d02a-4605-85c5-3a5b80239be2'),
 ('69501ff4-0100-3e0e-6850-21fa6a505e02','d85a7eac-67d2-4d7f-9257-21cecaebfed8'),
 ('b64c25b8-0100-66d1-b74c-4369b74c8c89','479eac64-b82c-49d8-a141-80a68de1ba75'),
 ('aab94e13-0100-4b8c-abb9-059fabb9999f','b34e2c67-476a-4625-9521-f7d1ce3cc5b9'),
 ('2a74b366-0100-36fd-2b74-859b2b74ea63','6e9aa792-b73b-4e34-8298-9e1f9d5cc912'),
 ('352b78ac-0100-36d4-342b-4e78362baf80','2a7d392e-9f70-46c3-be80-d48be8fdd743'),
 ('c3447d7a-0100-5bd1-c244-26abc444d94b','31b15e1c-6172-4869-8e25-dbe31d5520fb'),
 ('ddec0594-0100-2491-dcec-2105deec2a25','921f26cc-96c7-4f15-85b0-b649961151bc'),
 ('37c53428-0100-3673-36c5-025b38c56a9b','b987d04b-ebd6-4f11-859f-107d198695b9'),
 ('a7bd9748-0100-2eba-a6bd-b9f2a8bdc602','fab7242f-4f2f-4b50-af5a-42ca70bd3504'),
 ('4daa69e0-0100-2246-4caa-4ba64eaa8c26','aa44fcd6-8852-4bfd-8b87-16aaa63209f2'),
 ('6b9c1900-0100-4961-6a9c-50616c9c6261','91156790-1fbc-4e82-9bf4-55a6dca3ac3d'),
 ('c8bbd88c-0100-56e3-c9bb-8e6fc9bc2f6f','72c08b26-c61b-4c9b-b39a-8be8033355ea')
 ) AS mappings(hub,remote_id) LOOP
  IF (SELECT count(*) FROM public.ph_products WHERE alix_product_id=v.hub)<>1 THEN RAISE EXCEPTION 'Alix-ID nicht eindeutig: %',v.hub; END IF;
  SELECT * INTO p FROM public.ph_products WHERE alix_product_id=v.hub FOR UPDATE;
  IF NOT (p.active_de=false OR EXISTS(SELECT 1 FROM public.ph_product_channels WHERE product_id=p.id AND channel_code='de' AND hold=true)) THEN RAISE EXCEPTION 'Artikel nicht für Deutschland deaktiviert'; END IF;
  IF EXISTS(SELECT 1 FROM public.ph_lang_sync_map WHERE site_code='de' AND remote_product_id=v.remote_id AND product_id<>p.id) THEN RAISE EXCEPTION 'DE-Kennung bereits fremd zugeordnet'; END IF;
  IF EXISTS(SELECT 1 FROM public.ph_lang_sync_map WHERE product_id=p.id AND site_code='de' AND verified_at IS NOT NULL AND remote_product_id IS DISTINCT FROM v.remote_id) THEN RAISE EXCEPTION 'Bestehende bestätigte DE-Zuordnung abweichend'; END IF;
  INSERT INTO public.ph_lang_sync_map(product_id,site_code,remote_product_id,verified_at,note)
  VALUES(p.id,'de',v.remote_id,now(),'GLOBAL DE-Originalexport: exakte eindeutige Alix-ID; Abschaltauftrag 21.11.2026. Keine Zuordnung anhand Name oder Aktivflag.')
  ON CONFLICT(product_id,site_code) DO UPDATE SET remote_product_id=EXCLUDED.remote_product_id,verified_at=EXCLUDED.verified_at,note=concat_ws(E'\n',ph_lang_sync_map.note,EXCLUDED.note),updated_at=now();
  INSERT INTO public.ph_sync_log(product_id,channel_code,direction,operation,status,payload)
  VALUES(p.id,'de','internal','de_mapping_confirmation','ok',jsonb_build_object('source','GLOBAL src/features/de-original/products.json','hub_id',v.hub,'remote_product_id',v.remote_id,'verification','unique_exact_hub_id','website_write',false));
  IF NOT EXISTS(SELECT 1 FROM public.ph_lang_sync_map WHERE product_id=p.id AND site_code='de' AND remote_product_id=v.remote_id AND verified_at IS NOT NULL) THEN RAISE EXCEPTION 'DE-Zuordnung nicht bestätigt'; END IF;
  n:=n+1;
 END LOOP;
 IF n<>16 THEN RAISE EXCEPTION 'Erwartet 16 bestätigte Zuordnungen'; END IF;
END $$;