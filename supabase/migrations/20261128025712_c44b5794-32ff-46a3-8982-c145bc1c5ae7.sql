DO $$ DECLARE src text; BEGIN
 src:=pg_get_functiondef('ph_signal_private.ph2_require_release_matrix(text,uuid)'::regprocedure);
 src:=replace(src,'conn jsonb;','conn jsonb; conn_time timestamptz;');
 src:=replace(src,'SELECT payload INTO conn FROM public.ph_sync_log','SELECT payload,created_at INTO conn,conn_time FROM public.ph_sync_log');
 src:=replace(src,'IF conn IS NULL OR conn->>''result''','IF conn IS NULL OR conn_time<now()-interval ''24 hours'' OR conn->>''context'' IS DISTINCT FROM ph_signal_private.ph2_release_context(_channel) OR conn->>''result''');
 IF position('conn_time<now()' in src)=0 THEN RAISE EXCEPTION 'Kontextprüfung nicht ergänzt'; END IF;
 EXECUTE src;
END $$;