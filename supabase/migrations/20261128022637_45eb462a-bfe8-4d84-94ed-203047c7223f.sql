CREATE OR REPLACE FUNCTION public.ph2_record_release_proof(_kind text, _channel text, _passed boolean, _details jsonb, _actor uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE g public.ph_settings; v jsonb; lid uuid; bp jsonb;
BEGIN
  IF _kind NOT IN ('backup','restore','bundle') OR _passed IS NULL OR _actor IS NULL OR _details IS NULL THEN RAISE EXCEPTION 'Ungültiger Nachweis'; END IF;
  IF _kind='bundle' AND (_channel IS NULL OR _channel NOT IN ('de','com')) THEN RAISE EXCEPTION 'Kanal fehlt'; END IF;
  IF _kind<>'bundle' THEN _channel:=NULL; END IF;
  SELECT * INTO g FROM public.ph_settings WHERE key='ph2_activation' FOR UPDATE;
  IF _kind='restore' AND _passed THEN
    bp:=g.value->'backup_proof';
    IF coalesce((g.value->>'backup_verified')::boolean,false) IS NOT TRUE OR bp->>'backup_id' IS DISTINCT FROM _details->>'backup_id' THEN
      RAISE EXCEPTION 'Wiederherstellungstest muss die nachgewiesene Vollsicherung verwenden'; END IF;
  END IF;
  INSERT INTO public.ph_sync_log(channel_code,direction,operation,status,message,payload)
  VALUES(_channel,'internal','ph2_release_proof',CASE WHEN _passed THEN 'ok' ELSE 'error' END,
    CASE _kind WHEN 'backup' THEN 'Vollsicherung geprüft' WHEN 'restore' THEN 'Wiederherstellungstest' ELSE 'API-Abrufprüfung' END,
    _details||jsonb_build_object('kind',_kind,'passed',_passed,'requested_by',_actor)) RETURNING id INTO lid;
  IF _kind IN ('backup','restore') THEN
    v:=g.value||jsonb_build_object(_kind||'_verified',_passed,_kind||'_proof',jsonb_build_object('log_id',lid,'backup_id',_details->>'backup_id','at',clock_timestamp(),'by',_actor,'passed',_passed),'revision',coalesce((g.value->>'revision')::integer,0)+1);
    IF _kind='backup' THEN v:=v||jsonb_build_object('restore_verified',false); END IF;
    UPDATE public.ph_settings SET value=v,updated_at=clock_timestamp(),updated_by=_actor WHERE id=g.id;
  END IF;
  RETURN jsonb_build_object('log_id',lid,'passed',_passed);
END $$;
REVOKE ALL ON FUNCTION public.ph2_record_release_proof(text,text,boolean,jsonb,uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ph2_record_release_proof(text,text,boolean,jsonb,uuid) TO service_role;

CREATE OR REPLACE FUNCTION ph_signal_private.ph2_lift_emergency_stop(_confirmation text, _revision integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE g public.ph_settings; v jsonb;
BEGIN
  PERFORM ph_signal_private.ph2_require_super_admin();
  IF _confirmation IS DISTINCT FROM 'NOTSTOPP AUFHEBEN' THEN RAISE EXCEPTION 'Ausdrückliche Bestätigung fehlt'; END IF;
  SELECT * INTO g FROM public.ph_settings WHERE key='ph2_activation' FOR UPDATE;
  IF _revision IS DISTINCT FROM coalesce((g.value->>'revision')::integer,0) THEN RAISE EXCEPTION 'Stand wurde inzwischen geändert; bitte neu laden'; END IF;
  IF NOT g.value @> '{"backup_verified":true,"restore_verified":true}'::jsonb THEN RAISE EXCEPTION 'Notstopp bleibt: Vollsicherung und Wiederherstellungstest müssen nachgewiesen sein'; END IF;
  v:=g.value||jsonb_build_object('emergency_stopped',false,'revision',_revision+1,'emergency_lifted_by',auth.uid(),'emergency_lifted_at',clock_timestamp());
  UPDATE public.ph_settings SET value=v,updated_at=clock_timestamp(),updated_by=auth.uid() WHERE id=g.id;
  INSERT INTO public.ph_sync_log(direction,operation,status,message,payload) VALUES('internal','ph2_emergency_lift','ok','Notstopp manuell aufgehoben; Betriebsmodi unverändert gesperrt',jsonb_build_object('requested_by',auth.uid(),'revision',_revision+1,'channels',g.value->'channels'));
  RETURN v;
END $$;
REVOKE ALL ON FUNCTION ph_signal_private.ph2_lift_emergency_stop(text,integer) FROM public, anon;
CREATE OR REPLACE FUNCTION public.ph2_lift_emergency_stop(_confirmation text, _revision integer) RETURNS jsonb LANGUAGE sql SET search_path TO 'public' AS $$ SELECT ph_signal_private.ph2_lift_emergency_stop(_confirmation,_revision) $$;
REVOKE ALL ON FUNCTION public.ph2_lift_emergency_stop(text,integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.ph2_lift_emergency_stop(text,integer) TO authenticated;
GRANT USAGE ON SCHEMA ph_signal_private TO authenticated;
GRANT EXECUTE ON FUNCTION ph_signal_private.ph2_lift_emergency_stop(text,integer) TO authenticated;

-- Pilot/full now additionally require a manually lifted emergency stop (no implicit lifting).
DO $do$
DECLARE src text;
BEGIN
  src:=pg_get_functiondef('ph_signal_private.ph2_set_operating_mode(text,text,uuid,text,integer)'::regprocedure);
  IF position('Notstopp ist aktiv' in src)=0 THEN
    src:=replace(src,'IF _mode<>''blocked'' THEN IF NOT g.value @>','IF _mode<>''blocked'' THEN IF coalesce((g.value->>''emergency_stopped'')::boolean,true) THEN RAISE EXCEPTION ''Freigabe gesperrt: Notstopp ist aktiv und muss zuerst manuell aufgehoben werden''; END IF; IF NOT g.value @>');
    src:=replace(src,'''emergency_stopped'',CASE WHEN _mode=''blocked'' THEN coalesce((g.value->>''emergency_stopped'')::boolean,true) ELSE false END','''emergency_stopped'',coalesce((g.value->>''emergency_stopped'')::boolean,true)');
    IF position('Notstopp ist aktiv' in src)=0 OR position('ELSE false END),' in src)>0 AND position('''emergency_stopped'',CASE' in src)>0 THEN RAISE EXCEPTION 'Patch fehlgeschlagen'; END IF;
    EXECUTE src;
  END IF;
END $do$;