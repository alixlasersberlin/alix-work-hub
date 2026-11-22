DO $$
DECLARE p public.ph_products%ROWTYPE;
BEGIN
 LOCK TABLE public.ph_products IN SHARE ROW EXCLUSIVE MODE;
 SELECT * INTO p FROM public.ph_products WHERE id='d6775fb7-5de5-4ab4-b126-e2577b5e4a1d' FOR UPDATE;
 IF NOT FOUND OR btrim(p.name)<>'BodyGlow' THEN RAISE EXCEPTION 'BodyGlow-Artikel nicht eindeutig gefunden'; END IF;
 IF p.alix_product_id IS NOT NULL AND p.alix_product_id<>'d6775fb7-5de5-4ab4-b126-e2577b5e4a1d' THEN RAISE EXCEPTION 'Bestehende Hub-Kennung darf nicht überschrieben werden'; END IF;
 IF EXISTS(SELECT 1 FROM public.ph_products WHERE id<>p.id AND alix_product_id='d6775fb7-5de5-4ab4-b126-e2577b5e4a1d') THEN RAISE EXCEPTION 'Hub-Kennung bereits vergeben'; END IF;
 PERFORM 1 FROM public.ph_product_channels WHERE product_id=p.id FOR UPDATE;
 IF EXISTS(SELECT 1 FROM public.ph_product_channels WHERE product_id=p.id AND (remote_snapshot->'global_pending' IS NOT NULL OR remote_snapshot->'global_offline_pending' IS NOT NULL OR remote_snapshot->'ae_pending' IS NOT NULL OR remote_snapshot->'beauty_pending' IS NOT NULL)) THEN RAISE EXCEPTION 'Unklarer Webseitenvorgang muss zuerst geprüft werden'; END IF;
 IF p.alix_product_id IS NULL THEN
  INSERT INTO public.ph_sync_log(product_id,channel_code,direction,operation,status,payload) VALUES(p.id,'com','internal','hub_identity_confirmation','ok',jsonb_build_object('source','explicit_user_request_2026_11_22','previous_hub_id',p.alix_product_id,'confirmed_hub_id','d6775fb7-5de5-4ab4-b126-e2577b5e4a1d','sent',false));
  UPDATE public.ph_products SET alix_product_id='d6775fb7-5de5-4ab4-b126-e2577b5e4a1d' WHERE id=p.id;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.ph_products WHERE id=p.id AND alix_product_id='d6775fb7-5de5-4ab4-b126-e2577b5e4a1d') THEN RAISE EXCEPTION 'Hub-Kennung nicht gespeichert'; END IF;
END $$;