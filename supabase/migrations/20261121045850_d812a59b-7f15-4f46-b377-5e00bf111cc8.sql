CREATE OR REPLACE FUNCTION public.ph_beauty_claim_offline(p_product_id uuid,p_request jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.ph_product_channels%ROWTYPE; p public.ph_products%ROWTYPE; proof jsonb;
BEGIN
 IF p_request->>'channel' IS DISTINCT FROM 'beautyco' OR p_request->>'action' IS DISTINCT FROM 'deactivate' OR p_request->>'target_origin' IS DISTINCT FROM 'https://alix-beauty.com' THEN RAISE EXCEPTION 'Ungültiger Beauty-Auftrag'; END IF;
 PERFORM (p_request->>'operation_id')::uuid;
 SELECT * INTO p FROM public.ph_products WHERE id=p_product_id FOR SHARE;
 IF NOT FOUND OR p.alix_product_id IS DISTINCT FROM p_request->>'hub_id' THEN RAISE EXCEPTION 'Beauty-Gerätekennung nicht bestätigt'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.user_profiles up JOIN public.user_roles ur ON ur.user_id=up.id JOIN public.roles r ON r.id=ur.role_id WHERE up.id=(p_request->'approval'->>'actor_id')::uuid AND up.is_active AND up.account_status='active' AND r.name='Super Admin') THEN RAISE EXCEPTION 'Aktiver Super Admin erforderlich'; END IF;
 SELECT * INTO c FROM public.ph_product_channels WHERE product_id=p_product_id AND channel_code='beautyco' FOR UPDATE;
 IF NOT FOUND OR NOT c.hold THEN RAISE EXCEPTION 'Beauty-Kanal nicht deaktiviert'; END IF;
 IF c.remote_snapshot->'beauty_offline_pending' IS NOT NULL OR c.remote_snapshot->'beauty_offline' IS NOT NULL THEN RAISE EXCEPTION 'Beauty-Abschaltung läuft, ist unklar oder bereits bestätigt'; END IF;
 proof:=c.remote_snapshot->'beauty_online';
 IF proof->>'ok' IS DISTINCT FROM 'true' OR proof->>'online' IS DISTINCT FROM 'true' OR proof->>'state' IS DISTINCT FROM 'online' OR proof->>'hub_id' IS DISTINCT FROM p.alix_product_id OR proof->>'channel' IS DISTINCT FROM 'beautyco' OR proof->>'version' IS DISTINCT FROM p_request->>'expected_version' THEN RAISE EXCEPTION 'Letzte bestätigte Beauty-ONLINE-Version fehlt oder ist geändert'; END IF;
 IF (p_request->>'version')::timestamptz < (proof->>'version')::timestamptz OR (p_request->>'version')::timestamptz IS DISTINCT FROM c.updated_at THEN RAISE EXCEPTION 'Beauty-Kanalentscheidung geändert'; END IF;
 UPDATE public.ph_product_channels SET remote_snapshot=coalesce(remote_snapshot,'{}'::jsonb)||jsonb_build_object('beauty_offline_pending',p_request),has_pending_changes=true,last_sync_status='pending' WHERE id=c.id;
 INSERT INTO public.ph_sync_log(product_id,channel_code,direction,operation,status,payload) VALUES(p_product_id,'beautyco','export','beauty_deactivate','pending',jsonb_build_object('request',p_request));
END $$;
REVOKE ALL ON FUNCTION public.ph_beauty_claim_offline(uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ph_beauty_claim_offline(uuid,jsonb) TO service_role;
CREATE OR REPLACE FUNCTION public.ph_beauty_finish_offline(p_product_id uuid,p_operation_id uuid,p_reply jsonb,p_offline boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.ph_product_channels%ROWTYPE; pending jsonb;
BEGIN
 SELECT * INTO c FROM public.ph_product_channels WHERE product_id=p_product_id AND channel_code='beautyco' FOR UPDATE;
 pending:=c.remote_snapshot->'beauty_offline_pending';
 IF NOT FOUND OR pending->>'operation_id' IS DISTINCT FROM p_operation_id::text THEN RAISE EXCEPTION 'Beauty-Abschaltreservierung fehlt'; END IF;
 IF p_offline AND (NOT c.hold OR p_reply->>'ok' IS DISTINCT FROM 'true' OR p_reply->>'offline' IS DISTINCT FROM 'true' OR p_reply->>'online' IS DISTINCT FROM 'false' OR p_reply->>'dry_run' IS DISTINCT FROM 'false' OR p_reply->>'state' IS DISTINCT FROM 'OFFLINE' OR p_reply->>'operation_id' IS DISTINCT FROM pending->>'operation_id' OR p_reply->>'hub_id' IS DISTINCT FROM pending->>'hub_id' OR p_reply->>'version' IS DISTINCT FROM pending->>'version' OR p_reply->>'channel' IS DISTINCT FROM 'beautyco' OR p_reply->'verification'->>'detail_status' NOT IN ('404','410') OR p_reply->'verification'->>'detail_status' IS NULL OR p_reply->'verification'->>'catalog_visible' IS DISTINCT FROM 'false' OR p_reply->'verification'->>'search_visible' IS DISTINCT FROM 'false' OR coalesce(p_reply->'verification'->>'public_url','') NOT LIKE 'https://alix-beauty.com/beauty-geraete/%') THEN RAISE EXCEPTION 'Beauty-Abschaltnachweis unvollständig'; END IF;
 UPDATE public.ph_product_channels SET remote_snapshot=CASE WHEN p_offline THEN (coalesce(remote_snapshot,'{}'::jsonb)-'beauty_offline_pending')||jsonb_build_object('beauty_offline',p_reply) ELSE coalesce(remote_snapshot,'{}'::jsonb)||jsonb_build_object('beauty_offline_failure',p_reply) END,has_pending_changes=NOT p_offline,last_sync_status=CASE WHEN p_offline THEN 'ok' ELSE 'error' END,last_sync_at=CASE WHEN p_offline THEN now() ELSE last_sync_at END,publish_state=CASE WHEN p_offline THEN 'inactive' ELSE publish_state END WHERE id=c.id;
 UPDATE public.ph_sync_log SET status=CASE WHEN p_offline THEN 'ok' ELSE 'error' END,payload=payload||jsonb_build_object('reply',p_reply) WHERE product_id=p_product_id AND operation='beauty_deactivate' AND payload->'request'->>'operation_id'=p_operation_id::text;
END $$;
REVOKE ALL ON FUNCTION public.ph_beauty_finish_offline(uuid,uuid,jsonb,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ph_beauty_finish_offline(uuid,uuid,jsonb,boolean) TO service_role;