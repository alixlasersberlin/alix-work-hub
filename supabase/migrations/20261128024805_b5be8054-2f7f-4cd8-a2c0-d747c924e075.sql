CREATE OR REPLACE FUNCTION ph_signal_private.ph2_release_context(_channel text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE snapshot jsonb; stamps jsonb; t record; parts jsonb := '{}'::jsonb;
BEGIN
 IF _channel IS NOT NULL AND _channel NOT IN ('de','com') THEN RAISE EXCEPTION 'Ungültiger Kanal'; END IF;
 FOR t IN SELECT table_name FROM information_schema.columns WHERE table_schema='public' AND table_name LIKE 'ph\_%' ESCAPE '\' AND column_name='updated_at' AND table_name NOT IN ('ph_sync_log','ph_settings','ph_product_channels') ORDER BY table_name LOOP
   EXECUTE format('SELECT coalesce(jsonb_agg(x ORDER BY x::text),''[]''::jsonb) FROM (SELECT updated_at FROM public.%I) q(x)',t.table_name) INTO stamps;
   parts:=parts||jsonb_build_object(t.table_name,stamps);
 END LOOP;
 SELECT jsonb_build_object('tables',parts,'settings',(SELECT coalesce(jsonb_agg(jsonb_build_array(key,updated_at) ORDER BY key),'[]'::jsonb) FROM public.ph_settings WHERE key<>'ph2_activation'),
 'channel_rows',(SELECT coalesce(jsonb_agg(jsonb_build_array(id,updated_at) ORDER BY id),'[]'::jsonb) FROM public.ph_product_channels WHERE _channel IS NULL OR channel_code=_channel)) INTO snapshot;
 RETURN md5(snapshot::text);
END $$;
REVOKE ALL ON FUNCTION ph_signal_private.ph2_release_context(text) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION ph_signal_private.ph2_release_context(text) TO service_role;
CREATE OR REPLACE FUNCTION public.ph2_release_context(_channel text DEFAULT NULL) RETURNS text LANGUAGE sql SET search_path=public AS $$ SELECT ph_signal_private.ph2_release_context(_channel) $$;
REVOKE ALL ON FUNCTION public.ph2_release_context(text) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ph2_release_context(text) TO service_role;

CREATE OR REPLACE FUNCTION public.ph2_record_release_proof(_kind text,_channel text,_passed boolean,_details jsonb,_actor uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE g public.ph_settings; v jsonb; lid uuid; bp jsonb; expected text;
BEGIN
 IF _kind NOT IN ('backup','restore','bundle','communication','pilot_dry_run','security') OR _passed IS NULL OR _actor IS NULL OR _details IS NULL THEN RAISE EXCEPTION 'Ungültiger Nachweis'; END IF;
 IF _kind IN ('bundle','communication','pilot_dry_run') AND (_channel IS NULL OR _channel NOT IN ('de','com')) THEN RAISE EXCEPTION 'Kanal fehlt'; END IF;
 IF _kind IN ('backup','restore','security') THEN _channel:=NULL; END IF;
 SELECT * INTO g FROM public.ph_settings WHERE key='ph2_activation' FOR UPDATE;
 expected:=ph_signal_private.ph2_release_context(_channel);
 IF _details->>'context' IS DISTINCT FROM expected THEN RAISE EXCEPTION 'Konfiguration hat sich während der Prüfung geändert; erneut prüfen'; END IF;
 IF _kind='restore' AND _passed THEN
   bp:=g.value->'backup_proof';
   IF _details->>'isolated' IS DISTINCT FROM 'true' OR _details->>'complete' IS DISTINCT FROM 'true' OR _details->>'manifest_verified' IS DISTINCT FROM 'true' OR _details->>'read_api_verified' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Isolierter vollständiger Wiederherstellungstest fehlt'; END IF;
   IF coalesce((g.value->>'backup_verified')::boolean,false) IS NOT TRUE OR bp->>'backup_id' IS DISTINCT FROM _details->>'backup_id' THEN RAISE EXCEPTION 'Wiederherstellung muss die geprüfte Sicherung verwenden'; END IF;
 END IF;
 IF _kind='communication' AND _passed AND NOT _details @> '{"connection_verified":true,"replay_verified":true,"emergency_verified":true,"api_compatible":true}'::jsonb THEN RAISE EXCEPTION 'Kommunikationsnachweis unvollständig'; END IF;
 IF _kind='pilot_dry_run' AND _passed AND NOT _details @> '{"slug":"alix-apex","receiver_confirmed":true,"apex_only":true,"emergency_verified":true}'::jsonb THEN RAISE EXCEPTION 'Apex-Empfängernachweis fehlt'; END IF;
 IF _kind='security' AND _passed AND NOT _details @> '{"complete":true,"confirmed_high":0,"confirmed_critical":0}'::jsonb THEN RAISE EXCEPTION 'Sicherheitsprüfung unvollständig oder blockierend'; END IF;
 INSERT INTO public.ph_sync_log(channel_code,direction,operation,status,message,payload) VALUES(_channel,'internal','ph2_release_proof',CASE WHEN _passed THEN 'ok' ELSE 'error' END,'Release Control v1.1: '||_kind,_details||jsonb_build_object('kind',_kind,'passed',_passed,'requested_by',_actor,'checked_at',clock_timestamp())) RETURNING id INTO lid;
 IF _kind IN ('backup','restore') THEN
   v:=g.value||jsonb_build_object(_kind||'_verified',_passed,_kind||'_proof',jsonb_build_object('log_id',lid,'backup_id',_details->>'backup_id','at',clock_timestamp(),'by',_actor,'passed',_passed,'context',expected,'isolated',coalesce((_details->>'isolated')::boolean,false)),'revision',coalesce((g.value->>'revision')::integer,0)+1);
   IF _kind='backup' THEN v:=v||jsonb_build_object('restore_verified',false); END IF;
   UPDATE public.ph_settings SET value=v,updated_at=clock_timestamp(),updated_by=_actor WHERE id=g.id;
 END IF;
 RETURN jsonb_build_object('log_id',lid,'passed',_passed);
END $$;
REVOKE ALL ON FUNCTION public.ph2_record_release_proof(text,text,boolean,jsonb,uuid) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ph2_record_release_proof(text,text,boolean,jsonb,uuid) TO service_role;

CREATE OR REPLACE FUNCTION ph_signal_private.ph2_require_release_matrix(_channel text,_pilot uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE k text; p jsonb; at_time timestamptz; log_channel text; ctx text; conn jsonb;
BEGIN
 FOR k IN SELECT unnest(ARRAY['backup','restore','bundle','communication','pilot_dry_run','security']) LOOP
   log_channel:=CASE WHEN k IN ('backup','restore','security') THEN NULL ELSE _channel END;
   SELECT payload,created_at INTO p,at_time FROM public.ph_sync_log WHERE operation='ph2_release_proof' AND channel_code IS NOT DISTINCT FROM log_channel AND payload->>'kind'=k ORDER BY created_at DESC LIMIT 1;
   ctx:=ph_signal_private.ph2_release_context(log_channel);
   IF p IS NULL OR p->>'passed' IS DISTINCT FROM 'true' OR at_time<now()-interval '24 hours' OR p->>'context' IS DISTINCT FROM ctx THEN RAISE EXCEPTION 'Freigabe gesperrt: Nachweis % fehlt, ist veraltet oder ungültig',k; END IF;
   IF k='backup' AND coalesce((p->>'backup_created_at')::timestamptz,'epoch'::timestamptz)<now()-interval '36 hours' THEN RAISE EXCEPTION 'Vollsicherung ist veraltet'; END IF;
   IF k='restore' AND NOT p @> '{"isolated":true,"complete":true,"manifest_verified":true,"read_api_verified":true}'::jsonb THEN RAISE EXCEPTION 'Isolierte Wiederherstellung fehlt'; END IF;
   IF k='pilot_dry_run' AND (p->>'local_product_id' IS DISTINCT FROM _pilot::text OR p->>'slug' IS DISTINCT FROM 'alix-apex' OR p->>'receiver_confirmed' IS DISTINCT FROM 'true') THEN RAISE EXCEPTION 'Apex-Pilotnachweis stimmt nicht mit gewähltem Gerät überein'; END IF;
 END LOOP;
 IF NOT EXISTS(SELECT 1 FROM public.ph_products WHERE id=_pilot AND slug='alix-apex') THEN RAISE EXCEPTION 'Nur Apex mit Slug alix-apex ist freigegeben'; END IF;
 SELECT payload INTO conn FROM public.ph_sync_log WHERE operation='ph2_connection_test' AND channel_code=_channel ORDER BY created_at DESC LIMIT 1;
 IF conn IS NULL OR conn->>'result' IS DISTINCT FROM 'accepted' OR conn->>'signature' IS DISTINCT FROM 'verified' OR conn->>'receipt' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Vollständiger Verbindungstest mit Signatur und Rückmeldung fehlt'; END IF;
END $$;
REVOKE ALL ON FUNCTION ph_signal_private.ph2_require_release_matrix(text,uuid) FROM public,anon,authenticated;

ALTER FUNCTION ph_signal_private.ph2_set_operating_mode(text,text,uuid,text,integer) RENAME TO ph2_set_operating_mode_v10;
REVOKE ALL ON FUNCTION ph_signal_private.ph2_set_operating_mode_v10(text,text,uuid,text,integer) FROM public,anon,authenticated;
CREATE FUNCTION ph_signal_private.ph2_set_operating_mode(_channel text,_mode text,_pilot uuid,_confirmation text,_revision integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE g jsonb; selected uuid;
BEGIN
 PERFORM ph_signal_private.ph2_require_super_admin();
 SELECT value INTO g FROM public.ph_settings WHERE key='ph2_activation' FOR UPDATE;
 IF _mode IN ('pilot','full') THEN
   selected:=CASE WHEN _mode='pilot' THEN _pilot ELSE nullif(g->'channels'->_channel->>'pilot_product_id','')::uuid END;
   PERFORM ph_signal_private.ph2_require_release_matrix(_channel,selected);
 END IF;
 RETURN ph_signal_private.ph2_set_operating_mode_v10(_channel,_mode,_pilot,_confirmation,_revision);
END $$;
REVOKE ALL ON FUNCTION ph_signal_private.ph2_set_operating_mode(text,text,uuid,text,integer) FROM public,anon;
GRANT EXECUTE ON FUNCTION ph_signal_private.ph2_set_operating_mode(text,text,uuid,text,integer) TO authenticated;
-- Refresh the invoker facade after renaming its previous target.
CREATE OR REPLACE FUNCTION public.ph2_set_operating_mode(_channel text,_mode text,_pilot uuid,_confirmation text,_revision integer) RETURNS jsonb LANGUAGE sql SET search_path=public AS $$ SELECT ph_signal_private.ph2_set_operating_mode(_channel,_mode,_pilot,_confirmation,_revision) $$;

CREATE OR REPLACE FUNCTION ph_signal_private.ph2_lift_emergency_stop(_confirmation text,_revision integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE g public.ph_settings; v jsonb; p jsonb; k text; stamp timestamptz;
BEGIN
 PERFORM ph_signal_private.ph2_require_super_admin();
 IF _confirmation IS DISTINCT FROM 'NOTSTOPP AUFHEBEN' THEN RAISE EXCEPTION 'Ausdrückliche Bestätigung fehlt'; END IF;
 SELECT * INTO g FROM public.ph_settings WHERE key='ph2_activation' FOR UPDATE;
 IF _revision IS DISTINCT FROM coalesce((g.value->>'revision')::integer,0) THEN RAISE EXCEPTION 'Stand wurde inzwischen geändert; bitte neu laden'; END IF;
 FOREACH k IN ARRAY ARRAY['backup','restore'] LOOP
   SELECT payload,created_at INTO p,stamp FROM public.ph_sync_log WHERE operation='ph2_release_proof' AND payload->>'kind'=k AND channel_code IS NULL ORDER BY created_at DESC LIMIT 1;
   IF p IS NULL OR p->>'passed' IS DISTINCT FROM 'true' OR stamp<now()-interval '24 hours' OR p->>'context' IS DISTINCT FROM ph_signal_private.ph2_release_context(NULL) THEN RAISE EXCEPTION 'Notstopp bleibt: aktueller Nachweis % fehlt',k; END IF;
   IF k='restore' AND NOT p @> '{"isolated":true,"complete":true,"manifest_verified":true,"read_api_verified":true}'::jsonb THEN RAISE EXCEPTION 'Notstopp bleibt: isolierter vollständiger Restore fehlt'; END IF;
 END LOOP;
 IF NOT g.value @> '{"backup_verified":true,"restore_verified":true}'::jsonb THEN RAISE EXCEPTION 'Vollsicherung und isolierte Wiederherstellung fehlen'; END IF;
 v:=g.value||jsonb_build_object('emergency_stopped',false,'revision',_revision+1,'emergency_lifted_by',auth.uid(),'emergency_lifted_at',clock_timestamp());
 UPDATE public.ph_settings SET value=v,updated_at=clock_timestamp(),updated_by=auth.uid() WHERE id=g.id;
 INSERT INTO public.ph_sync_log(direction,operation,status,message,payload) VALUES('internal','ph2_emergency_lift','ok','Notstopp ausdrücklich manuell aufgehoben',jsonb_build_object('requested_by',auth.uid(),'revision',_revision+1));
 RETURN v;
END $$;