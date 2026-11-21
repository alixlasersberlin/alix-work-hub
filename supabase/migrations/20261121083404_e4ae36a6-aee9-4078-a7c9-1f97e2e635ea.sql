CREATE OR REPLACE FUNCTION public.ph_beauty_claim_release(p_product_id uuid,p_request jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.ph_product_channels%ROWTYPE; p public.ph_products%ROWTYPE;
BEGIN
 IF p_request->>'channel' IS DISTINCT FROM 'beautyco' OR p_request->>'target_origin' IS DISTINCT FROM 'https://alix-beauty.com' OR p_request->>'schema_version' IS DISTINCT FROM '1' OR p_request->>'country' IS DISTINCT FROM 'DE' OR p_request->>'locale' IS DISTINCT FROM 'de' OR p_request->'approval'->>'source' IS DISTINCT FROM 'alixwork' OR p_request->'approval'->>'role' IS DISTINCT FROM 'Super Admin' THEN RAISE EXCEPTION 'Ungültiger Beauty-Freigabeauftrag'; END IF;
 PERFORM (p_request->>'publication_id')::uuid;
 IF p_request->>'publication_id' IS NULL THEN RAISE EXCEPTION 'Freigabekennung fehlt'; END IF;
 SELECT * INTO p FROM public.ph_products WHERE id=p_product_id FOR SHARE;
 IF NOT FOUND OR p.alix_product_id IS DISTINCT FROM p_request->>'hub_id' OR p.alix_product_id IS NULL OR p.status IS DISTINCT FROM 'published' OR p.active_de IS DISTINCT FROM true OR (p_request->>'version')::timestamptz IS DISTINCT FROM p.updated_at THEN RAISE EXCEPTION 'Beauty-Gerät oder freigegebene Version geändert'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.user_profiles up JOIN public.user_roles ur ON ur.user_id=up.id JOIN public.roles r ON r.id=ur.role_id WHERE up.id=(p_request->'approval'->>'actor_id')::uuid AND up.is_active AND up.account_status='active' AND r.name='Super Admin') THEN RAISE EXCEPTION 'Aktiver Super Admin erforderlich'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.ph_channels WHERE code='beautyco' AND is_active) THEN RAISE EXCEPTION 'Beauty-Webseite deaktiviert'; END IF;
 SELECT * INTO c FROM public.ph_product_channels WHERE product_id=p_product_id AND channel_code='beautyco' FOR UPDATE;
 IF NOT FOUND OR c.hold IS DISTINCT FROM false OR c.status IS DISTINCT FROM 'published' THEN RAISE EXCEPTION 'Beauty-Kanal nicht freigegeben'; END IF;
 IF c.remote_snapshot->'beauty_pending' IS NOT NULL OR c.remote_snapshot->'beauty_offline_pending' IS NOT NULL OR c.remote_snapshot->'beauty_offline' IS NOT NULL THEN RAISE EXCEPTION 'Beauty-Vorgang gesperrt; keine Wiederholung oder ungeprüfte Reaktivierung'; END IF;
 UPDATE public.ph_product_channels SET remote_snapshot=coalesce(remote_snapshot,'{}'::jsonb)||jsonb_build_object('beauty_pending',p_request),has_pending_changes=true,last_sync_status='pending' WHERE id=c.id;
 INSERT INTO public.ph_sync_log(product_id,channel_code,direction,operation,status,payload) VALUES(p_product_id,'beautyco','export','beauty_direct_release','pending',jsonb_build_object('request',p_request));
END $$;
REVOKE ALL ON FUNCTION public.ph_beauty_claim_release(uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ph_beauty_claim_release(uuid,jsonb) TO service_role;
CREATE OR REPLACE FUNCTION public.ph_beauty_finish_release(p_product_id uuid,p_publication_id uuid,p_reply jsonb,p_online boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.ph_product_channels%ROWTYPE; p public.ph_products%ROWTYPE; pending jsonb;
BEGIN
 SELECT * INTO p FROM public.ph_products WHERE id=p_product_id FOR SHARE;
 SELECT * INTO c FROM public.ph_product_channels WHERE product_id=p_product_id AND channel_code='beautyco' FOR UPDATE;
 pending:=c.remote_snapshot->'beauty_pending';
 IF NOT FOUND OR pending->>'publication_id' IS DISTINCT FROM p_publication_id::text OR pending IS NULL THEN RAISE EXCEPTION 'Beauty-Freigabereservierung fehlt'; END IF;
 IF p_online THEN
  IF p.status IS DISTINCT FROM 'published' OR p.active_de IS DISTINCT FROM true OR p.alix_product_id IS DISTINCT FROM pending->>'hub_id' OR p.updated_at IS DISTINCT FROM (pending->>'version')::timestamptz OR c.hold IS DISTINCT FROM false OR c.status IS DISTINCT FROM 'published' OR c.remote_snapshot->'beauty_offline_pending' IS NOT NULL OR c.remote_snapshot->'beauty_offline' IS NOT NULL THEN RAISE EXCEPTION 'Beauty-Freigabe vor Abschluss zurückgezogen oder geändert'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.ph_channels WHERE code='beautyco' AND is_active) OR NOT EXISTS(SELECT 1 FROM public.user_profiles up JOIN public.user_roles ur ON ur.user_id=up.id JOIN public.roles r ON r.id=ur.role_id WHERE up.id=(pending->'approval'->>'actor_id')::uuid AND up.is_active AND up.account_status='active' AND r.name='Super Admin') THEN RAISE EXCEPTION 'Beauty-Freigabeberechtigung zurückgezogen'; END IF;
  IF p_reply->>'ok' IS DISTINCT FROM 'true' OR p_reply->>'online' IS DISTINCT FROM 'true' OR p_reply->>'state' IS DISTINCT FROM 'online' OR p_reply->>'dry_run' IS DISTINCT FROM 'false' OR p_reply->>'hub_id' IS DISTINCT FROM pending->>'hub_id' OR p_reply->>'version' IS DISTINCT FROM pending->>'version' OR p_reply->>'channel' IS DISTINCT FROM 'beautyco' OR p_reply->>'publication_id' IS DISTINCT FROM pending->>'publication_id' OR coalesce(p_reply->>'content_hash','') !~ '^[a-f0-9]{64}$' OR coalesce(p_reply->>'public_url','') !~ '^https://alix-beauty\.com/beauty-geraete/[a-z0-9-]+$' THEN RAISE EXCEPTION 'Beauty-ONLINE-Nachweis unvollständig'; END IF;
 END IF;
 UPDATE public.ph_product_channels SET remote_snapshot=CASE WHEN p_online THEN (coalesce(remote_snapshot,'{}'::jsonb)-'beauty_pending')||jsonb_build_object('beauty_online',p_reply) ELSE coalesce(remote_snapshot,'{}'::jsonb)||jsonb_build_object('beauty_release_failure',p_reply) END,has_pending_changes=NOT p_online,last_sync_status=CASE WHEN p_online THEN 'ok' ELSE 'error' END,last_sync_at=CASE WHEN p_online THEN now() ELSE last_sync_at END,live_version=CASE WHEN p_online THEN pending->>'version' ELSE live_version END,live_url=CASE WHEN p_online THEN p_reply->>'public_url' ELSE live_url END,publish_state=CASE WHEN p_online THEN 'published' ELSE publish_state END WHERE id=c.id;
 UPDATE public.ph_sync_log SET status=CASE WHEN p_online THEN 'ok' ELSE 'error' END,payload=payload||jsonb_build_object('reply',p_reply) WHERE product_id=p_product_id AND operation='beauty_direct_release' AND payload->'request'->>'publication_id'=p_publication_id::text;
END $$;
REVOKE ALL ON FUNCTION public.ph_beauty_finish_release(uuid,uuid,jsonb,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ph_beauty_finish_release(uuid,uuid,jsonb,boolean) TO service_role;
DO $$ DECLARE original text; revised text; BEGIN
 original:=pg_get_functiondef('public.ph_beauty_claim_offline(uuid,jsonb)'::regprocedure);
 revised:=replace(original,'IF c.remote_snapshot->''beauty_offline_pending'' IS NOT NULL','IF c.remote_snapshot->''beauty_pending'' IS NOT NULL OR c.remote_snapshot->''beauty_offline_pending'' IS NOT NULL');
 IF original=revised THEN RAISE EXCEPTION 'Beauty-Abschaltsperre konnte nicht ergänzt werden'; END IF;
 EXECUTE revised;
END $$;