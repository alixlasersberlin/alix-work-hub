CREATE POLICY ml_notification_current_lead ON public.app_notifications AS RESTRICTIVE FOR SELECT TO authenticated USING (metadata->>'ml_dedup_key' IS NULL OR public.ml_can_access((metadata->>'lead_id')::uuid));
CREATE FUNCTION lead_private.ml_wa_review() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF NOT lead_private.ml_wa_admin() THEN RAISE EXCEPTION 'Nur Admin und Super Admin' USING ERRCODE='42501'; END IF;
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('event_id',external_id,'at',event_at,'reason',payload->'result'->>'reason','name',payload->'data'->>'name','phone',payload->'data'->>'phone')) FROM (SELECT * FROM public.alixsmart_events WHERE event_type='sales.whatsapp.inbound' AND payload->'result'->>'status'='needs_review' ORDER BY event_at DESC LIMIT 200)x),'[]'::jsonb); END $$;
REVOKE ALL ON FUNCTION lead_private.ml_wa_review() FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION lead_private.ml_wa_review() TO authenticated;
CREATE FUNCTION public.ml_wa_review() RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$ SELECT lead_private.ml_wa_review() $$;
REVOKE ALL ON FUNCTION public.ml_wa_review() FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.ml_wa_review() TO authenticated;
DO $$ DECLARE def text; BEGIN
 SELECT pg_get_functiondef('lead_private.ml_wa_ingest(jsonb)'::regprocedure) INTO def;
 def=replace(def,'signature=md5(_event::text);','signature=md5((_event || jsonb_build_object(''data'',d-''priority''-''product_interest''))::text);');
 def=replace(def,'md5(d::text)','md5((d-''priority''-''product_interest'')::text)');
 def=replace(def,'IF cardinality(customer_ids)>1 THEN','IF cardinality(customer_ids)>0 THEN');
 def=replace(def,'''ambiguous_customer''','''customer_phone_requires_confirmation''');
 def=replace(def,'IF jsonb_typeof(_event)<>''object'' OR','IF _event IS NULL OR jsonb_typeof(_event)<>''object'' OR');
 def=replace(def,'_event->>''event''<>''sales.whatsapp.inbound''','(_event->>''event'') IS DISTINCT FROM ''sales.whatsapp.inbound'' OR (_event->>''source'') IS DISTINCT FROM ''alixsmart'' OR (_event->>''version'') IS DISTINCT FROM ''1''');
 def=replace(def,'d->>''direction''<>''inbound'' OR d->>''area''<>''sales''','(d->>''direction'') IS DISTINCT FROM ''inbound'' OR (d->>''area'') IS DISTINCT FROM ''sales'' OR coalesce(_event->>''occurred_at'','''')=''''');
 EXECUTE def;
 END $$;