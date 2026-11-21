INSERT INTO public.ph_lang_sync_map(product_id,site_code,remote_product_id,remote_url,verified_at,note)
SELECT id,'de','5fbad909-f10d-4114-af26-cb72d5314f09','https://alix-lasers.de/produkte/hifu-pro',now(),'Confirmed GLOBAL direct release contract 4c242e67; original DE export identity, user-requested Hifu Pro acceptance'
FROM public.ph_products WHERE alix_product_id='82efb1d3-0100-22e6-83ef-933583efd4b9'
ON CONFLICT(product_id,site_code) DO NOTHING;
CREATE OR REPLACE FUNCTION public.ph_global_claim_release(p_product_id uuid,p_channel text,p_release jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.ph_product_channels%ROWTYPE; p public.ph_products%ROWTYPE; m public.ph_lang_sync_map%ROWTYPE;
BEGIN
 IF p_channel NOT IN ('com','de') OR jsonb_typeof(p_release)<>'object' OR p_release->>'channel' IS DISTINCT FROM p_channel OR p_release->>'publish_id' IS NULL THEN RAISE EXCEPTION 'Ungültige GLOBAL-Freigabe'; END IF;
 SELECT * INTO p FROM public.ph_products WHERE id=p_product_id FOR SHARE;
 IF NOT FOUND OR p.status NOT IN ('approved','published') OR NOT (CASE WHEN p_channel='com' THEN p.active_com ELSE p.active_de END) THEN RAISE EXCEPTION 'Gerät nicht freigegeben'; END IF;
 IF p_release->>'hub_id' IS DISTINCT FROM p.alix_product_id THEN RAISE EXCEPTION 'Geräteidentität geändert'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.user_profiles up JOIN public.user_roles ur ON ur.user_id=up.id JOIN public.roles r ON r.id=ur.role_id WHERE up.id=(p_release->'approval'->>'actor_id')::uuid AND up.is_active AND up.account_status='active' AND r.name='Super Admin') THEN RAISE EXCEPTION 'Aktiver Super Admin erforderlich'; END IF;
 SELECT * INTO m FROM public.ph_lang_sync_map WHERE product_id=p_product_id AND site_code=p_channel;
 IF NOT FOUND OR m.verified_at IS NULL OR m.remote_product_id IS DISTINCT FROM p_release->>'product_id' THEN RAISE EXCEPTION 'GLOBAL-Zuordnung nicht bestätigt'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.ph_channels WHERE code=p_channel AND is_active) THEN RAISE EXCEPTION 'Webseite nicht aktiv'; END IF;
 INSERT INTO public.ph_product_channels(product_id,channel_code) VALUES(p_product_id,p_channel) ON CONFLICT(product_id,channel_code) DO NOTHING;
 SELECT * INTO c FROM public.ph_product_channels WHERE product_id=p_product_id AND channel_code=p_channel FOR UPDATE;
 IF c.hold THEN RAISE EXCEPTION 'Kanal zurückgehalten'; END IF;
 IF c.remote_snapshot->'global_pending' IS NOT NULL THEN RAISE EXCEPTION 'Vorherige GLOBAL-Freigabe unklar oder läuft; nicht erneut senden'; END IF;
 IF c.remote_snapshot->'global_direct'->>'source_version' IS DISTINCT FROM p_release->>'expected_version' THEN RAISE EXCEPTION 'Freigabeversion zwischenzeitlich geändert'; END IF;
 UPDATE public.ph_product_channels SET remote_snapshot=coalesce(remote_snapshot,'{}'::jsonb)||jsonb_build_object('global_pending',p_release),has_pending_changes=true,last_sync_status='pending' WHERE id=c.id;
 INSERT INTO public.ph_sync_log(channel_code,action,status,payload) VALUES(p_channel,'global_direct_release','pending',jsonb_build_object('product_id',p_product_id,'release',p_release));
END $$;
REVOKE ALL ON FUNCTION public.ph_global_claim_release(uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ph_global_claim_release(uuid,text,jsonb) TO service_role;
CREATE OR REPLACE FUNCTION public.ph_global_finish_release(p_product_id uuid,p_channel text,p_publish_id uuid,p_reply jsonb,p_online boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.ph_product_channels%ROWTYPE; pending jsonb;
BEGIN
 SELECT * INTO c FROM public.ph_product_channels WHERE product_id=p_product_id AND channel_code=p_channel FOR UPDATE;
 pending:=c.remote_snapshot->'global_pending';
 IF NOT FOUND OR pending->>'publish_id' IS DISTINCT FROM p_publish_id::text THEN RAISE EXCEPTION 'GLOBAL-Reservierung nicht gefunden'; END IF;
 IF p_online AND (p_reply->>'status' IS DISTINCT FROM 'ONLINE' OR p_reply->>'online' IS DISTINCT FROM 'true' OR p_reply->>'ok' IS DISTINCT FROM 'true'
 OR p_reply->>'publish_id' IS DISTINCT FROM pending->>'publish_id' OR p_reply->>'product_id' IS DISTINCT FROM pending->>'product_id'
 OR p_reply->>'hub_id' IS DISTINCT FROM pending->>'hub_id' OR p_reply->>'source_version' IS DISTINCT FROM pending->>'source_version'
 OR p_reply->>'channel' IS DISTINCT FROM p_channel
 OR coalesce(p_reply->>'public_url','') NOT LIKE (CASE WHEN p_channel='de' THEN 'https://alix-lasers.de/produkte/%' ELSE 'https://www.alix-lasers.com/devices/%' END)) THEN RAISE EXCEPTION 'Online-Nachweis unvollständig'; END IF;
 UPDATE public.ph_product_channels SET
 remote_snapshot=CASE WHEN p_online THEN (coalesce(remote_snapshot,'{}'::jsonb)-'global_pending')||jsonb_build_object('global_direct',p_reply) ELSE coalesce(remote_snapshot,'{}'::jsonb)||jsonb_build_object('global_failure',p_reply) END,
 live_version=CASE WHEN p_online THEN p_reply->>'source_version' ELSE live_version END,
 live_url=CASE WHEN p_online THEN p_reply->>'public_url' ELSE live_url END,
 has_pending_changes=NOT p_online,last_sync_status=CASE WHEN p_online THEN 'ok' ELSE 'error' END,
 last_sync_at=CASE WHEN p_online THEN now() ELSE last_sync_at END WHERE id=c.id;
 UPDATE public.ph_sync_log SET status=CASE WHEN p_online THEN 'ok' ELSE 'error' END,response=p_reply WHERE channel_code=p_channel AND action='global_direct_release' AND payload->'release'->>'publish_id'=p_publish_id::text;
END $$;
REVOKE ALL ON FUNCTION public.ph_global_finish_release(uuid,text,uuid,jsonb,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ph_global_finish_release(uuid,text,uuid,jsonb,boolean) TO service_role;