CREATE OR REPLACE FUNCTION public.ph_ae_claim_operation(p_product_id uuid,p_envelope jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p public.ph_products%ROWTYPE; c public.ph_product_channels%ROWTYPE; m public.ph_lang_sync_map%ROWTYPE; req jsonb:=p_envelope->'request'; prior jsonb; act text:=req->>'action'; op text;
BEGIN
 IF act IS NULL OR act NOT IN ('publish','deactivate','reactivate') OR req->>'channel' IS DISTINCT FROM 'dubai' OR req->'approval'->>'channel' IS DISTINCT FROM 'dubai' OR req->'approval'->>'role' IS DISTINCT FROM 'super_admin' OR req->'approval'->>'active' IS DISTINCT FROM 'true' OR req->'approval'->>'hub_id' IS DISTINCT FROM req->>'hub_id' OR req->'approval'->>'source_version' IS DISTINCT FROM req->>'source_version' THEN RAISE EXCEPTION 'Ungültiger AE-Auftrag'; END IF;
 op:=CASE WHEN act='publish' THEN req->>'publish_id' ELSE req->>'operation_id' END;
 IF op IS NULL OR coalesce(req->>'source_version','')='' THEN RAISE EXCEPTION 'AE-Vorgangskennung fehlt'; END IF;
 PERFORM op::uuid;
 SELECT * INTO p FROM public.ph_products WHERE id=p_product_id FOR SHARE;
 IF NOT FOUND OR p.alix_product_id IS NULL OR p.alix_product_id IS DISTINCT FROM req->>'hub_id' OR p.updated_at IS DISTINCT FROM (p_envelope->>'product_updated_at')::timestamptz THEN RAISE EXCEPTION 'AE-Gerät zwischenzeitlich geändert'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.user_profiles up JOIN public.user_roles ur ON ur.user_id=up.id JOIN public.roles r ON r.id=ur.role_id WHERE up.id=(req->'approval'->>'actor_id')::uuid AND up.is_active AND up.account_status='active' AND r.name='Super Admin') THEN RAISE EXCEPTION 'Aktiver Super Admin erforderlich'; END IF;
 SELECT * INTO m FROM public.ph_lang_sync_map WHERE product_id=p_product_id AND site_code='dubai' FOR SHARE;
 IF NOT FOUND OR m.verified_at IS NULL OR m.remote_product_id IS DISTINCT FROM req->>'product_id' THEN RAISE EXCEPTION 'Bestätigte eigene AE-Gerätezuordnung fehlt'; END IF;
 PERFORM m.remote_product_id::uuid;
 IF NOT EXISTS(SELECT 1 FROM public.ph_channels WHERE code='dubai' AND is_active) THEN RAISE EXCEPTION 'AE-Webseite nicht aktiv'; END IF;
 SELECT * INTO c FROM public.ph_product_channels WHERE product_id=p_product_id AND channel_code='dubai' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'AE-Kanal fehlt'; END IF;
 IF c.remote_snapshot->'ae_pending' IS NOT NULL THEN RAISE EXCEPTION 'AE-Vorgang läuft oder ist unklar; kein Neuversand'; END IF;
 prior:=c.remote_snapshot->'ae_direct';
 IF prior->>'source_version' IS DISTINCT FROM req->>'expected_version' OR req->>'source_version' IS NOT DISTINCT FROM req->>'expected_version' THEN RAISE EXCEPTION 'AE-Versionsfolge geändert'; END IF;
 IF act='deactivate' THEN
  IF p.active_dubai IS DISTINCT FROM false AND c.hold IS DISTINCT FROM true THEN RAISE EXCEPTION 'AE-Gerät nicht deaktiviert'; END IF;
  IF req->>'reason' NOT IN ('inactive','withheld') OR req->>'reason' IS NULL OR prior->>'status'='OFFLINE' THEN RAISE EXCEPTION 'Ungültige oder bereits bestätigte AE-Abschaltung'; END IF;
 ELSE
  IF p.active_dubai IS DISTINCT FROM true OR p.status NOT IN ('approved','published') OR c.hold IS DISTINCT FROM false THEN RAISE EXCEPTION 'AE-Gerät nicht freigegeben'; END IF;
  IF act='publish' AND prior->>'status'='OFFLINE' THEN RAISE EXCEPTION 'AE-Abschaltsperre; explizite Reaktivierung erforderlich'; END IF;
  IF act='publish' AND NOT EXISTS(SELECT 1 FROM public.ph_product_translations t WHERE t.product_id=p_product_id AND t.locale='en' AND t.status IN ('approved','published') AND t.updated_at IS NOT DISTINCT FROM (p_envelope->>'translation_updated_at')::timestamptz) THEN RAISE EXCEPTION 'Freigegebene AE-Übersetzung geändert'; END IF;
  IF act='reactivate' AND (prior->>'ok' IS DISTINCT FROM 'true' OR prior->>'offline' IS DISTINCT FROM 'true' OR prior->>'status' IS DISTINCT FROM 'OFFLINE' OR prior->>'channel' IS DISTINCT FROM 'dubai' OR prior->>'hub_id' IS DISTINCT FROM req->>'hub_id' OR prior->>'product_id' IS DISTINCT FROM req->>'product_id' OR req->'approval'->>'reactivate' IS DISTINCT FROM 'true') THEN RAISE EXCEPTION 'Bestätigte AE-Abschaltung für Reaktivierung fehlt'; END IF;
 END IF;
 UPDATE public.ph_product_channels SET remote_snapshot=coalesce(remote_snapshot,'{}'::jsonb)||jsonb_build_object('ae_pending',p_envelope),has_pending_changes=true,last_sync_status='pending' WHERE id=c.id;
 INSERT INTO public.ph_sync_log(product_id,channel_code,direction,operation,status,payload) VALUES(p_product_id,'dubai','export','ae_'||act,'pending',p_envelope);
END $$;
REVOKE ALL ON FUNCTION public.ph_ae_claim_operation(uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ph_ae_claim_operation(uuid,jsonb) TO service_role;
CREATE OR REPLACE FUNCTION public.ph_ae_finish_operation(p_product_id uuid,p_operation_id uuid,p_reply jsonb,p_confirmed boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p public.ph_products%ROWTYPE; c public.ph_product_channels%ROWTYPE; m public.ph_lang_sync_map%ROWTYPE; envelope jsonb; req jsonb; act text; op text;
BEGIN
 SELECT * INTO p FROM public.ph_products WHERE id=p_product_id FOR SHARE;
 SELECT * INTO m FROM public.ph_lang_sync_map WHERE product_id=p_product_id AND site_code='dubai' FOR SHARE;
 SELECT * INTO c FROM public.ph_product_channels WHERE product_id=p_product_id AND channel_code='dubai' FOR UPDATE;
 envelope:=c.remote_snapshot->'ae_pending'; req:=envelope->'request'; act:=req->>'action'; op:=CASE WHEN act='publish' THEN req->>'publish_id' ELSE req->>'operation_id' END;
 IF NOT FOUND OR envelope IS NULL OR op IS DISTINCT FROM p_operation_id::text THEN RAISE EXCEPTION 'AE-Reservierung fehlt'; END IF;
 IF p_confirmed THEN
  IF p.alix_product_id IS DISTINCT FROM req->>'hub_id' OR p.updated_at IS DISTINCT FROM (envelope->>'product_updated_at')::timestamptz OR m.verified_at IS NULL OR m.remote_product_id IS DISTINCT FROM req->>'product_id' THEN RAISE EXCEPTION 'AE-Gerät oder Zuordnung vor Abschluss geändert'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.user_profiles up JOIN public.user_roles ur ON ur.user_id=up.id JOIN public.roles r ON r.id=ur.role_id WHERE up.id=(req->'approval'->>'actor_id')::uuid AND up.is_active AND up.account_status='active' AND r.name='Super Admin') OR NOT EXISTS(SELECT 1 FROM public.ph_channels WHERE code='dubai' AND is_active) THEN RAISE EXCEPTION 'AE-Freigabeberechtigung geändert'; END IF;
  IF act='deactivate' THEN
   IF (p.active_dubai IS DISTINCT FROM false AND c.hold IS DISTINCT FROM true) OR p_reply->>'status' IS DISTINCT FROM 'OFFLINE' OR p_reply->>'offline' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'AE-Abschaltung nicht bestätigt'; END IF;
  ELSE
   IF p.active_dubai IS DISTINCT FROM true OR p.status NOT IN ('approved','published') OR c.hold IS DISTINCT FROM false OR p_reply->>'status' IS DISTINCT FROM 'ONLINE' OR p_reply->>'online' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'AE-Freigabe zurückgezogen oder nicht bestätigt'; END IF;
   IF act='publish' AND NOT EXISTS(SELECT 1 FROM public.ph_product_translations t WHERE t.product_id=p_product_id AND t.locale='en' AND t.status IN ('approved','published') AND t.updated_at IS NOT DISTINCT FROM (envelope->>'translation_updated_at')::timestamptz) THEN RAISE EXCEPTION 'AE-Übersetzung vor Abschluss geändert'; END IF;
  END IF;
  IF p_reply->>'ok' IS DISTINCT FROM 'true' OR p_reply->>'dry_run'='true' OR p_reply->>'hub_id' IS DISTINCT FROM req->>'hub_id' OR p_reply->>'product_id' IS DISTINCT FROM req->>'product_id' OR p_reply->>'channel' IS DISTINCT FROM 'dubai' OR p_reply->>'source_version' IS DISTINCT FROM req->>'source_version' OR (CASE WHEN act='publish' THEN p_reply->>'publish_id' ELSE p_reply->>'operation_id' END) IS DISTINCT FROM op THEN RAISE EXCEPTION 'AE-Nachweis passt nicht zum Vorgang'; END IF;
  IF jsonb_typeof(p_reply->'public_urls') IS DISTINCT FROM 'array' OR jsonb_array_length(p_reply->'public_urls')<>2 OR coalesce(p_reply->'public_urls'->>0,'') !~ '^https://alix-lasers\.ae/systems/[a-z0-9-]+$' OR (p_reply->'public_urls'->>1) IS DISTINCT FROM replace(p_reply->'public_urls'->>0,'https://alix-lasers.ae/systems/','https://alix-lasers.ae/ar/systems/') OR (act<>'deactivate' AND p_reply->>'public_url' IS DISTINCT FROM p_reply->'public_urls'->>0) THEN RAISE EXCEPTION 'AE-öffentliche Webseitenadressen fehlen'; END IF;
 END IF;
 UPDATE public.ph_product_channels SET remote_snapshot=CASE WHEN p_confirmed THEN (coalesce(remote_snapshot,'{}'::jsonb)-'ae_pending')||jsonb_build_object('ae_direct',p_reply) ELSE coalesce(remote_snapshot,'{}'::jsonb)||jsonb_build_object('ae_failure',p_reply) END,has_pending_changes=NOT p_confirmed,last_sync_status=CASE WHEN p_confirmed THEN 'ok' ELSE 'error' END,last_sync_at=CASE WHEN p_confirmed THEN now() ELSE last_sync_at END,live_version=CASE WHEN p_confirmed THEN req->>'source_version' ELSE live_version END,live_url=CASE WHEN p_confirmed AND act<>'deactivate' THEN p_reply->>'public_url' ELSE live_url END,publish_state=CASE WHEN p_confirmed THEN CASE WHEN act='deactivate' THEN 'inactive' ELSE 'published' END ELSE publish_state END WHERE id=c.id;
 UPDATE public.ph_sync_log SET status=CASE WHEN p_confirmed THEN 'ok' ELSE 'error' END,payload=payload||jsonb_build_object('reply',p_reply) WHERE product_id=p_product_id AND operation='ae_'||act AND coalesce(payload->'request'->>'publish_id',payload->'request'->>'operation_id')=op;
END $$;
REVOKE ALL ON FUNCTION public.ph_ae_finish_operation(uuid,uuid,jsonb,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ph_ae_finish_operation(uuid,uuid,jsonb,boolean) TO service_role;