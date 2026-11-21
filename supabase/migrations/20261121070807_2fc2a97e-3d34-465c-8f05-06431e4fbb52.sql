DO $$
DECLARE v record; m public.ph_lang_sync_map%ROWTYPE; c public.ph_product_channels%ROWTYPE; snapshot jsonb;
BEGIN
 FOR v IN SELECT * FROM (VALUES
 ('3987c038-80a4-4dee-bfb2-65c72ac5647e'::uuid,'Aesthéra Pro 23D','03ec0cfc-0100-2a71-02ec-268d04ec376d','1ae43538-af1c-4388-927d-ba66a3fa666e'),
 ('9c14932d-08bc-448f-8907-0907d50e21c0'::uuid,'Alix Body Glow','94bd4d14-0100-2599-95bd-688d95bd72ad','7c42735c-0d96-4e6f-bf50-82873e83089d')
 ) AS targets(product_id,name,hub_id,remote_id) LOOP
  PERFORM 1 FROM public.ph_products WHERE id=v.product_id AND btrim(name)=v.name AND alix_product_id=v.hub_id AND active_com=false FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Eigener deaktivierter Artikel nicht eindeutig bestätigt: %',v.name; END IF;
  IF EXISTS(SELECT 1 FROM public.ph_lang_sync_map WHERE site_code='com' AND remote_product_id=v.remote_id AND product_id<>v.product_id) THEN RAISE EXCEPTION 'COM-Kennung bereits anderem Artikel zugeordnet'; END IF;
  SELECT * INTO m FROM public.ph_lang_sync_map WHERE product_id=v.product_id AND site_code='com' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bestehende COM-Zuordnung fehlt'; END IF;
  SELECT * INTO c FROM public.ph_product_channels WHERE product_id=v.product_id AND channel_code='com' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bestehender COM-Kanal fehlt'; END IF;
  snapshot:=coalesce(c.remote_snapshot,'{}'::jsonb);
  IF snapshot->'global_pending' IS NOT NULL OR snapshot->'global_offline_pending' IS NOT NULL THEN RAISE EXCEPTION 'Unklarer Versand muss zuerst geprüft werden'; END IF;
  IF m.remote_product_id IS DISTINCT FROM v.remote_id THEN
   INSERT INTO public.ph_sync_log(product_id,channel_code,direction,operation,status,payload)
   VALUES(v.product_id,'com','internal','com_mapping_confirmation','ok',jsonb_build_object('source','explicit_user_confirmation_2026_11_21','previous_mapping',to_jsonb(m),'previous_remote_snapshot',snapshot,'confirmed_remote_product_id',v.remote_id));
   UPDATE public.ph_product_channels SET remote_snapshot=(snapshot-'global_offline'-'global_direct') || jsonb_build_object('previous_com_identity',jsonb_build_object('remote_product_id',m.remote_product_id,'remote_snapshot',snapshot,'archived_at',now())),has_pending_changes=true WHERE id=c.id;
  END IF;
  UPDATE public.ph_lang_sync_map SET remote_product_id=v.remote_id,remote_url=NULL,verified_at=now(),updated_at=now(),note=concat_ws(E'\n',m.note,'COM-Kennung ausdrücklich vom Nutzer am 21.11.2026 bestätigt: '||v.remote_id) WHERE id=m.id;
  IF NOT EXISTS(SELECT 1 FROM public.ph_lang_sync_map WHERE id=m.id AND product_id=v.product_id AND site_code='com' AND remote_product_id=v.remote_id AND verified_at IS NOT NULL) THEN RAISE EXCEPTION 'Bestätigte Zuordnung nicht gespeichert'; END IF;
 END LOOP;
END $$;