DO $migration$
DECLARE v_product uuid := '03701a94-e0b3-4d56-8ce2-17a0ab79d720'; v_remote text := 'ea14530e-f989-4811-9520-7f3cf342c521';
BEGIN
  -- GLOBAL c5a51f49 src/features/de-original/products.json: exactly one
  -- status=ok row for this hub identity; COM's UUID is not the DE identity.
  PERFORM 1 FROM public.ph_products WHERE id=v_product AND alix_product_id='fe2266d4-0100-5c7e-ff22-3aaaff22c352' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Skin Master Mini Produktidentität stimmt nicht überein'; END IF;
  IF EXISTS (SELECT 1 FROM public.ph_lang_sync_map WHERE product_id=v_product AND site_code='de' AND remote_product_id<>v_remote) THEN
    RAISE EXCEPTION 'Widersprüchliche DE-Zuordnung; keine automatische Überschreibung';
  END IF;
  IF EXISTS (SELECT 1 FROM public.ph_lang_sync_map WHERE site_code='de' AND remote_product_id=v_remote AND product_id<>v_product) THEN
    RAISE EXCEPTION 'DE-Gerät bereits einem anderen Artikel zugeordnet';
  END IF;
  INSERT INTO public.ph_lang_sync_map(product_id,site_code,remote_product_id,remote_url,verified_at,note)
  VALUES(v_product,'de',v_remote,'https://alix-lasers.de/produkte/skin-master-mini',now(),'GLOBAL c5a51f49: exact unique alix_product_id match in src/features/de-original/products.json, status=ok; DE-only mapping recovery, not OFFLINE proof')
  ON CONFLICT(product_id,site_code) DO UPDATE SET
    remote_url=EXCLUDED.remote_url,
    verified_at=COALESCE(ph_lang_sync_map.verified_at,EXCLUDED.verified_at),
    note=concat_ws(E'\n',ph_lang_sync_map.note,EXCLUDED.note),updated_at=now();
END $migration$;