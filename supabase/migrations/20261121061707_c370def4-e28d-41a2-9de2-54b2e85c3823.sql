DO $migration$
DECLARE r record;
BEGIN
 FOR r IN SELECT * FROM (VALUES
 ('098ea6df-8bc5-4b0b-a900-ea2a3fd1b909'::uuid,'7968a853-0100-ab02-7868-03517a695355','6aaf6be5-c097-411d-ad24-5b46f5167c6e','https://alix-lasers.de/produkte/alix-ems-twin-voltera-ai'),
 ('3987c038-80a4-4dee-bfb2-65c72ac5647e'::uuid,'03ec0cfc-0100-2a71-02ec-268d04ec376d','fc4288b6-fe95-4354-84c6-c28ef66e6d54','https://alix-lasers.de/produkte/aesth%C3%A9ra'),
 ('9c14932d-08bc-448f-8907-0907d50e21c0'::uuid,'94bd4d14-0100-2599-95bd-688d95bd72ad','a93fa97c-f8ee-465f-bb87-f63dac394832','https://alix-lasers.de/produkte/bodyglow')
 ) AS v(product_id,hub_id,remote_id,remote_url)
 LOOP
  PERFORM 1 FROM public.ph_products WHERE id=r.product_id AND alix_product_id=r.hub_id AND active_de=false FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'DE-Deaktivierung oder Produktidentität stimmt nicht überein: %',r.product_id; END IF;
  IF EXISTS(SELECT 1 FROM public.ph_lang_sync_map WHERE product_id=r.product_id AND site_code='de' AND remote_product_id<>r.remote_id) OR EXISTS(SELECT 1 FROM public.ph_lang_sync_map WHERE site_code='de' AND remote_product_id=r.remote_id AND product_id<>r.product_id) THEN
   RAISE EXCEPTION 'Widersprüchliche DE-Zuordnung: %',r.product_id;
  END IF;
  INSERT INTO public.ph_lang_sync_map(product_id,site_code,remote_product_id,remote_url,verified_at,note)
  VALUES(r.product_id,'de',r.remote_id,r.remote_url,now(),'GLOBAL f362a897 src/features/de-original/products.json: exact unique alix_product_id, status=ok; DE-only shutdown mapping, not OFFLINE proof')
  ON CONFLICT(product_id,site_code) DO UPDATE SET verified_at=COALESCE(ph_lang_sync_map.verified_at,EXCLUDED.verified_at),remote_url=EXCLUDED.remote_url,updated_at=now();
 END LOOP;
END $migration$;