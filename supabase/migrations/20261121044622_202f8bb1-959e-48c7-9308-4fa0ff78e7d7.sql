CREATE OR REPLACE FUNCTION public.ph_global_claim_offline(p_product_id uuid,p_channel text,p_request jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p public.ph_products%ROWTYPE; c public.ph_product_channels%ROWTYPE; m public.ph_lang_sync_map%ROWTYPE; reason text;
BEGIN
 IF p_channel NOT IN ('com','de') OR p_request->>'action' IS DISTINCT FROM 'deactivate' OR p_request->>'channel' IS DISTINCT FROM p_channel OR p_request->>'operation_id' IS NULL OR coalesce(p_request->>'source_version','')='' THEN RAISE EXCEPTION 'Ungültige Abschaltung'; END IF;
 PERFORM (p_request->>'operation_id')::uuid;
 SELECT * INTO p FROM public.ph_products WHERE id=p_product_id FOR SHARE;
 IF NOT FOUND OR p_request->>'hub_id' IS DISTINCT FROM p.alix_product_id THEN RAISE EXCEPTION 'Gerät nicht bestätigt'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.user_profiles up JOIN public.user_roles ur ON ur.user_id=up.id JOIN public.roles r ON r.id=ur.role_id WHERE up.id=(p_request->'approval'->>'actor_id')::uuid AND up.is_active AND up.account_status='active' AND r.name='Super Admin') THEN RAISE EXCEPTION 'Aktiver Super Admin erforderlich'; END IF;
 SELECT * INTO m FROM public.ph_lang_sync_map WHERE product_id=p_product_id AND site_code=p_channel;
 IF NOT FOUND OR m.verified_at IS NULL OR m.remote_product_id IS DISTINCT FROM p_request->>'product_id' THEN RAISE EXCEPTION 'Bestätigte GLOBAL-Zuordnung fehlt'; END IF;
 INSERT INTO public.ph_product_channels(product_id,channel_code) VALUES(p_product_id,p_channel) ON CONFLICT(product_id,channel_code) DO NOTHING;
 SELECT * INTO c FROM public.ph_product_channels WHERE product_id=p_product_id AND channel_code=p_channel FOR UPDATE;
 reason:=CASE WHEN NOT (CASE WHEN p_channel='com' THEN p.active_com ELSE p.active_de END) THEN 'inactive' WHEN c.hold THEN 'withheld' ELSE NULL END;
 IF reason IS NULL OR p_request->>'reason' IS DISTINCT FROM reason THEN RAISE EXCEPTION 'Gerät ist nicht entsprechend deaktiviert'; END IF;
 IF c.remote_snapshot->'global_pending' IS NOT NULL OR c.remote_snapshot->'global_offline_pending' IS NOT NULL THEN RAISE EXCEPTION 'GLOBAL-Vorgang läuft oder ist unklar; kein automatischer Neuversand'; END IF;
 IF c.remote_snapshot->'global_offline' IS NOT NULL THEN RAISE EXCEPTION 'Abschaltung bereits bestätigt'; END IF;
 IF coalesce(c.remote_snapshot->'global_offline'->>'source_version',c.remote_snapshot->'global_direct'->>'source_version') IS DISTINCT FROM p_request->>'expected_version' OR p_request->>'source_version' IS NOT DISTINCT FROM p_request->>'expected_version' THEN RAISE EXCEPTION 'Abschaltversion geändert'; END IF;
 UPDATE public.ph_product_channels SET remote_snapshot=coalesce(remote_snapshot,'{}'::jsonb)||jsonb_build_object('global_offline_pending',p_request),has_pending_changes=true,last_sync_status='pending' WHERE id=c.id;
 INSERT INTO public.ph_sync_log(product_id,channel_code,direction,operation,status,payload) VALUES(p_product_id,p_channel,'export','global_deactivate','pending',jsonb_build_object('request',p_request));
END $$;
REVOKE ALL ON FUNCTION public.ph_global_claim_offline(uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ph_global_claim_offline(uuid,text,jsonb) TO service_role;
CREATE OR REPLACE FUNCTION public.ph_global_finish_offline(p_product_id uuid,p_channel text,p_operation_id uuid,p_reply jsonb,p_offline boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.ph_product_channels%ROWTYPE; pending jsonb;
BEGIN
 SELECT * INTO c FROM public.ph_product_channels WHERE product_id=p_product_id AND channel_code=p_channel FOR UPDATE;
 pending:=c.remote_snapshot->'global_offline_pending';
 IF NOT FOUND OR pending->>'operation_id' IS DISTINCT FROM p_operation_id::text THEN RAISE EXCEPTION 'Abschaltreservierung fehlt'; END IF;
 IF p_offline AND (p_reply->>'ok' IS DISTINCT FROM 'true' OR p_reply->>'offline' IS DISTINCT FROM 'true' OR p_reply->>'status' IS DISTINCT FROM 'OFFLINE' OR p_reply->>'operation_id' IS DISTINCT FROM pending->>'operation_id' OR p_reply->>'hub_id' IS DISTINCT FROM pending->>'hub_id' OR p_reply->>'product_id' IS DISTINCT FROM pending->>'product_id' OR p_reply->>'channel' IS DISTINCT FROM p_channel OR p_reply->>'source_version' IS DISTINCT FROM pending->>'source_version' OR jsonb_typeof(p_reply->'public_urls') IS DISTINCT FROM 'array' OR jsonb_array_length(p_reply->'public_urls')=0) THEN RAISE EXCEPTION 'Abschaltnachweis unvollständig'; END IF;
 UPDATE public.ph_product_channels SET remote_snapshot=CASE WHEN p_offline THEN (coalesce(remote_snapshot,'{}'::jsonb)-'global_offline_pending')||jsonb_build_object('global_offline',p_reply) ELSE coalesce(remote_snapshot,'{}'::jsonb)||jsonb_build_object('global_offline_failure',p_reply) END,has_pending_changes=NOT p_offline,last_sync_status=CASE WHEN p_offline THEN 'ok' ELSE 'error' END,last_sync_at=CASE WHEN p_offline THEN now() ELSE last_sync_at END,publish_state=CASE WHEN p_offline THEN 'inactive' ELSE publish_state END WHERE id=c.id;
 UPDATE public.ph_sync_log SET status=CASE WHEN p_offline THEN 'ok' ELSE 'error' END,payload=payload||jsonb_build_object('reply',p_reply) WHERE operation='global_deactivate' AND product_id=p_product_id AND channel_code=p_channel AND payload->'request'->>'operation_id'=p_operation_id::text;
END $$;
REVOKE ALL ON FUNCTION public.ph_global_finish_offline(uuid,text,uuid,jsonb,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ph_global_finish_offline(uuid,text,uuid,jsonb,boolean) TO service_role;
DO $$ DECLARE definition text; BEGIN
 definition:=pg_get_functiondef('public.ph_global_claim_release(uuid,text,jsonb)'::regprocedure);
 definition:=replace(definition,'IF c.hold THEN','IF c.hold OR c.remote_snapshot->''global_offline_pending'' IS NOT NULL OR c.remote_snapshot->''global_offline'' IS NOT NULL THEN');
 EXECUTE definition;
 definition:=pg_get_functiondef('public.ph_global_finish_release(uuid,text,uuid,jsonb,boolean)'::regprocedure);
 definition:=replace(definition,'BEGIN' || chr(10) || ' SELECT * INTO c', 'BEGIN' || chr(10) || ' PERFORM 1 FROM public.ph_products WHERE id=p_product_id AND status IN (''approved'',''published'') AND (CASE WHEN p_channel=''com'' THEN active_com ELSE active_de END) FOR SHARE;' || chr(10) || ' IF p_online AND NOT FOUND THEN RAISE EXCEPTION ''Gerät zwischenzeitlich deaktiviert''; END IF;' || chr(10) || ' SELECT * INTO c');
 definition:=replace(definition,'pending:=c.remote_snapshot->''global_pending'';', 'pending:=c.remote_snapshot->''global_pending'';' || chr(10) || ' IF p_online AND (c.hold OR c.remote_snapshot->''global_offline_pending'' IS NOT NULL OR c.remote_snapshot->''global_offline'' IS NOT NULL) THEN RAISE EXCEPTION ''Kanal zwischenzeitlich deaktiviert''; END IF;');
 EXECUTE definition;
END $$;