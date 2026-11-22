DO $$
DECLARE
 v_product uuid := '5a30941e-7988-4134-8970-958d7c18b00e';
 v_remote text := '13914134-4b95-4f3f-a064-71f725c7d110';
 m public.ph_lang_sync_map%ROWTYPE;
BEGIN
 LOCK TABLE public.ph_lang_sync_map IN SHARE ROW EXCLUSIVE MODE;
 PERFORM 1 FROM public.ph_products WHERE id=v_product AND name='Aesthéra' AND alix_product_id='Aesthéra 13D' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Aesthéra nicht eindeutig gefunden'; END IF;
 IF EXISTS(SELECT 1 FROM public.ph_lang_sync_map WHERE site_code='com' AND remote_product_id=v_remote AND product_id<>v_product) THEN RAISE EXCEPTION 'COM-Kennung bereits einem anderen Gerät zugeordnet'; END IF;
 PERFORM 1 FROM public.ph_product_channels WHERE product_id=v_product AND channel_code='com' FOR UPDATE;
 IF EXISTS(SELECT 1 FROM public.ph_product_channels WHERE product_id=v_product AND channel_code='com' AND ((remote_snapshot->'global_pending' IS NOT NULL AND remote_snapshot->'global_pending'<>'null'::jsonb) OR (remote_snapshot->'global_offline_pending' IS NOT NULL AND remote_snapshot->'global_offline_pending'<>'null'::jsonb))) THEN RAISE EXCEPTION 'Laufende oder unklare COM-Übertragung'; END IF;
 SELECT * INTO m FROM public.ph_lang_sync_map WHERE product_id=v_product AND site_code='com' FOR UPDATE;
 IF FOUND AND NULLIF(m.remote_product_id,'') IS NOT NULL AND m.remote_product_id<>v_remote THEN RAISE EXCEPTION 'Bestehende abweichende COM-Kennung muss geprüft werden'; END IF;
 INSERT INTO public.ph_lang_sync_map(product_id,site_code,remote_product_id,verified_at,note)
 VALUES(v_product,'com',v_remote,now(),'COM-Kennung ausdrücklich vom Nutzer am 22.11.2026 bestätigt; keine unabhängige Empfängerprüfung und kein Versand erfolgt.')
 ON CONFLICT(product_id,site_code) DO UPDATE SET remote_product_id=EXCLUDED.remote_product_id,verified_at=EXCLUDED.verified_at,note=concat_ws(E'\n',ph_lang_sync_map.note,EXCLUDED.note),updated_at=now();
 INSERT INTO public.ph_sync_log(product_id,channel_code,direction,operation,status,payload)
 VALUES(v_product,'com','internal','com_mapping_confirmation','ok',jsonb_build_object('source','explicit_user_confirmation_2026_11_22','previous_mapping',CASE WHEN m.id IS NULL THEN NULL ELSE to_jsonb(m) END,'confirmed_remote_product_id',v_remote,'remote_checked',false,'sent',false));
 IF NOT EXISTS(SELECT 1 FROM public.ph_lang_sync_map WHERE product_id=v_product AND site_code='com' AND remote_product_id=v_remote AND verified_at IS NOT NULL) THEN RAISE EXCEPTION 'COM-Zuordnung nicht gespeichert'; END IF;
END $$;