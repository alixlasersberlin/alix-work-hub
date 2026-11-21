DO $$
DECLARE
 v record;
 p public.ph_products%ROWTYPE;
 m public.ph_lang_sync_map%ROWTYPE;
 c public.ph_product_channels%ROWTYPE;
 n integer := 0;
BEGIN
 -- One-time, explicitly approved identity backfill, not an application write endpoint.
 -- Serialize with both identity assignments and protected channel reservations.
 LOCK TABLE public.ph_products IN SHARE ROW EXCLUSIVE MODE;
 LOCK TABLE public.ph_lang_sync_map IN SHARE ROW EXCLUSIVE MODE;
 LOCK TABLE public.ph_product_channels IN SHARE ROW EXCLUSIVE MODE;
 FOR v IN SELECT * FROM (VALUES
 ('bb205943-a946-40ce-8459-a88d5f6bd377','ffd067a0-0100-7870-fed0-1fd000d0e010','c531d499-b0ac-45f6-8a43-daca6f44bda6'),
 ('4ed75883-f287-43e3-9bdf-d29471943ee7','d1429ed8-0100-4f7d-d042-d1a5d242ee55','a2f53b29-82c4-4e1b-a2cc-a5964ed7b01d'),
 ('88f875aa-5b67-471a-a226-ff46ca4aec41','0cd888b0-0100-5658-0dd8-dee80dd8df08','0170b489-0685-48b0-a5a3-b70ba5451b14'),
 ('33533c66-49a4-46ed-8b89-cdf54846b55c','39db4c08-0100-3659-38db-7a513adb8261','301b316d-0d33-4e4c-a90e-a486bc0ce96f'),
 ('09bbfa14-cf6c-49e1-a842-5e31181f2d33','802f57e8-0100-36af-812f-6147812f8e97','d40c3922-216d-4290-abaa-af132c79bceb'),
 ('11014dd4-a293-47f9-ab7b-91a30815ec5c','c349e0e0-0100-5dae-c249-bd4ec44a3e8e','554f4847-7aec-46ba-92b1-9c0374fc48fa'),
 ('cd5030e6-6e83-4c60-b14c-032f695c12b6','f5fd2638-0100-2f42-f4fd-097af6fd557a','399b5111-df8e-4867-833c-154fd7b0ee30'),
 ('b14e35d7-83bc-484a-b653-53c6d112edb6','30c3a2f0-0100-6485-31c3-c67531c40775','c716c1d0-46ad-4efe-bfba-75d961421b21'),
 ('6de91fb3-8799-4e2d-aa3c-663e27e6f64a','a2091ec0-0100-6b01-a309-75c1a30989c1','1202f7d6-0c71-4042-9a09-4048946ef1cd')
 ) AS mappings(product_id,hub_id,remote_id) LOOP
  SELECT * INTO STRICT p FROM public.ph_products WHERE id=v.product_id::uuid FOR UPDATE;
  IF p.alix_product_id IS DISTINCT FROM v.hub_id OR (SELECT count(*) FROM public.ph_products WHERE alix_product_id=v.hub_id) <> 1 THEN
   RAISE EXCEPTION 'Alix-Produktkennung geändert oder nicht eindeutig: %',p.name;
  END IF;
  IF EXISTS (SELECT 1 FROM public.ph_lang_sync_map WHERE site_code='de' AND remote_product_id=v.remote_id AND product_id<>p.id) THEN
   RAISE EXCEPTION 'DE-Kennung bereits einem anderen Gerät zugeordnet: %',v.remote_id;
  END IF;
  SELECT * INTO m FROM public.ph_lang_sync_map WHERE product_id=p.id AND site_code='de' FOR UPDATE;
  IF nullif(trim(m.remote_product_id),'') IS NOT NULL AND m.remote_product_id IS DISTINCT FROM v.remote_id THEN
   RAISE EXCEPTION 'Bestehende DE-Kennung wird nicht ersetzt: %',p.name;
  END IF;
  SELECT * INTO c FROM public.ph_product_channels WHERE product_id=p.id AND channel_code='de' FOR UPDATE;
  IF c.remote_snapshot ? 'global_pending' OR c.remote_snapshot ? 'global_offline_pending' THEN
   RAISE EXCEPTION 'Laufender oder unklarer DE-Vorgang: %',p.name;
  END IF;
  IF m.remote_product_id=v.remote_id AND m.verified_at IS NOT NULL THEN
   n := n+1;
   CONTINUE;
  END IF;
  INSERT INTO public.ph_lang_sync_map(product_id,site_code,remote_product_id,verified_at,note)
  VALUES(p.id,'de',v.remote_id,now(),'Nutzerfreigabe 21.11.2026: neun Kennungen aus Vorschau; GLOBAL Snapshot f362a897, DE-Originalexport, identische eindeutige Alix-Produktkennung. Kein Webseitenversand.')
  ON CONFLICT(product_id,site_code) DO UPDATE SET
   remote_product_id=EXCLUDED.remote_product_id,
   remote_url=NULL,
   verified_at=EXCLUDED.verified_at,
   note=concat_ws(E'\n',ph_lang_sync_map.note,'Vorher: '||coalesce(ph_lang_sync_map.remote_product_id,'—'),EXCLUDED.note),
   updated_at=now();
  INSERT INTO public.ph_sync_log(product_id,channel_code,direction,operation,status,payload)
  VALUES(p.id,'de','internal','de_mapping_confirmation','ok',jsonb_build_object(
   'source','GLOBAL f362a897 src/features/de-original/products.json',
   'hub_id',v.hub_id,'remote_product_id',v.remote_id,
   'verification','unique_exact_hub_id','authorization','explicit_user_approval_of_nine_preview_mappings',
   'previous_remote_product_id',m.remote_product_id,'website_write',false));
  IF NOT EXISTS (SELECT 1 FROM public.ph_lang_sync_map WHERE product_id=p.id AND site_code='de' AND remote_product_id=v.remote_id AND verified_at IS NOT NULL) THEN
   RAISE EXCEPTION 'DE-Kennung nicht bestätigt gespeichert: %',p.name;
  END IF;
  n := n+1;
 END LOOP;
 IF n<>9 THEN RAISE EXCEPTION 'Erwartet neun bestätigte DE-Zuordnungen, gefunden %',n; END IF;
END $$;