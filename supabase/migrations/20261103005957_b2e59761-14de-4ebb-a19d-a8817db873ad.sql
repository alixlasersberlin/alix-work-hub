CREATE OR REPLACE FUNCTION lead_private.ml_wa_chat(_lead_id uuid,_before timestamptz DEFAULT NULL,_limit integer DEFAULT 50) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE l public.sales_leads; msgs jsonb;
BEGIN
 IF NOT public.ml_can_access(_lead_id) THEN RAISE EXCEPTION 'Lead nicht zugänglich' USING ERRCODE='42501'; END IF;
 IF _limit<1 OR _limit>100 THEN RAISE EXCEPTION 'Ungültige Seitengröße'; END IF;
 SELECT * INTO l FROM public.sales_leads WHERE id=_lead_id;
 SELECT coalesce(jsonb_agg(x.message ORDER BY x.at DESC,x.id DESC),'[]'::jsonb) INTO msgs FROM (
 SELECT h.id,h.created_at at,jsonb_build_object('id',h.note::jsonb->>'message_id','direction',CASE h.action WHEN 'whatsapp_received' THEN 'inbound' ELSE 'outbound' END,'text',h.note::jsonb->>'note','at',coalesce(h.note::jsonb->>'at',h.created_at::text),'status',coalesce(h.note::jsonb->>'status','received'),'media',coalesce(h.note::jsonb->'media',e.payload->'data'->'media','[]'::jsonb)) message
 FROM public.sales_lead_history h LEFT JOIN public.alixsmart_events e ON e.external_id='ml-wa:event:'||(SELECT ev.external_id FROM public.alixsmart_events ev WHERE false LIMIT 1)
 WHERE h.lead_id=_lead_id AND h.action IN ('whatsapp_received','whatsapp_bridge_message') AND (_before IS NULL OR h.created_at<_before)
 ORDER BY h.created_at DESC,h.id DESC LIMIT _limit
 )x;
 RETURN jsonb_build_object('linked',l.metadata->'whatsapp_sales'->>'contact_id' IS NOT NULL AND l.metadata->'whatsapp_sales'->>'conversation_id' IS NOT NULL,'contact_id',l.metadata->'whatsapp_sales'->>'contact_id','conversation_id',l.metadata->'whatsapp_sales'->>'conversation_id','tenant_id',l.tenant_id,'messages',msgs,'has_more',jsonb_array_length(msgs)=_limit);
END $$;
REVOKE ALL ON FUNCTION lead_private.ml_wa_chat(uuid,timestamptz,integer) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION lead_private.ml_wa_chat(uuid,timestamptz,integer) TO authenticated;
CREATE OR REPLACE FUNCTION public.ml_wa_chat(_lead_id uuid,_before timestamptz DEFAULT NULL,_limit integer DEFAULT 50) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$ SELECT lead_private.ml_wa_chat(_lead_id,_before,_limit) $$;
REVOKE ALL ON FUNCTION public.ml_wa_chat(uuid,timestamptz,integer) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.ml_wa_chat(uuid,timestamptz,integer) TO authenticated;
CREATE OR REPLACE FUNCTION lead_private.ml_wa_chat_event(_event jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE d jsonb; lid uuid; ids uuid[]; old jsonb; h public.sales_lead_history; hash text; outcome jsonb; mid text; eid text;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Nur autorisierte Integration' USING ERRCODE='42501'; END IF;
 IF _event IS NULL OR jsonb_typeof(_event)<>'object' OR octet_length(_event::text)>65536 OR (_event->>'source') IS DISTINCT FROM 'alixsmart' OR (_event->>'version') IS DISTINCT FROM '1' OR _event->>'event' NOT IN ('sales.whatsapp.message','sales.whatsapp.status') THEN RAISE EXCEPTION 'Ungültiges Chatereignis'; END IF;
 d=_event->'data'; mid=d->>'message_id'; eid=_event->>'event_id';
 IF coalesce(mid,'')='' OR coalesce(eid,'')='' OR coalesce(d->>'contact_id','')='' OR coalesce(d->>'conversation_id','')='' OR coalesce(d->>'tenant_id','')='' OR (d->>'area') IS DISTINCT FROM 'sales' OR coalesce(_event->>'occurred_at','')='' THEN RAISE EXCEPTION 'Unvollständige Identität'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('ml-wa-ingestion-v1',0)); hash=md5(_event::text);
 SELECT payload INTO old FROM public.alixsmart_events WHERE external_id='ml-chat:event:'||eid;
 IF old IS NOT NULL THEN
 IF old->>'request_hash' IS DISTINCT FROM hash THEN RAISE EXCEPTION 'Ereignis-ID mit anderem Inhalt' USING ERRCODE='P0001'; END IF;
 RETURN old->'result'||jsonb_build_object('deduped',true); END IF;
 SELECT array_agg(l.id) INTO ids FROM public.sales_leads l JOIN public.tenants t ON t.id=l.tenant_id AND t.is_active WHERE l.tenant_id=(d->>'tenant_id')::uuid AND l.metadata->'whatsapp_sales'->>'contact_id'=d->>'contact_id' AND l.metadata->'whatsapp_sales'->>'conversation_id'=d->>'conversation_id';
 IF coalesce(cardinality(ids),0)<>1 THEN RETURN jsonb_build_object('ok',false,'status','needs_review','reason','unconfirmed_identity'); END IF;
 lid=ids[1];
 SELECT * INTO h FROM public.sales_lead_history WHERE lead_id=lid AND action IN ('whatsapp_received','whatsapp_bridge_message') AND note::jsonb->>'message_id'=mid ORDER BY created_at LIMIT 1 FOR UPDATE;
 IF _event->>'event'='sales.whatsapp.status' THEN
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'status','needs_review','reason','message_not_received'); END IF;
 IF coalesce(d->>'status','') NOT IN ('queued','sent','delivered','read','failed','undelivered') THEN RAISE EXCEPTION 'Ungültiger Zustellstatus'; END IF;
 IF coalesce((h.note::jsonb->>'status_at')::timestamptz,'-infinity')<=(_event->>'occurred_at')::timestamptz AND NOT(h.note::jsonb->>'status'='read' AND d->>'status' IN ('queued','sent','delivered')) AND NOT(h.note::jsonb->>'status'='delivered' AND d->>'status' IN ('queued','sent')) THEN
 UPDATE public.sales_lead_history SET note=(h.note::jsonb||jsonb_build_object('status',d->>'status','status_at',_event->>'occurred_at','error',d->>'error'))::text WHERE id=h.id;
 END IF;
 ELSE
 IF coalesce(d->>'direction','') NOT IN ('inbound','outbound') OR coalesce(d->>'text','')='' AND jsonb_array_length(coalesce(d->'media','[]'::jsonb))=0 THEN RAISE EXCEPTION 'Ungültige Nachricht'; END IF;
 IF h.id IS NOT NULL THEN
 IF h.note::jsonb->>'note' IS DISTINCT FROM coalesce(d->>'text','') OR h.action='whatsapp_received' AND d->>'direction'<>'inbound' OR h.action='whatsapp_bridge_message' AND h.note::jsonb->>'direction' IS DISTINCT FROM d->>'direction' THEN RAISE EXCEPTION 'Nachrichten-ID mit anderem Inhalt' USING ERRCODE='P0001'; END IF;
 ELSE
 INSERT INTO public.sales_lead_history(lead_id,action,note) VALUES(lid,CASE d->>'direction' WHEN 'inbound' THEN 'whatsapp_received' ELSE 'whatsapp_bridge_message' END,jsonb_build_object('message_id',mid,'conversation_id',d->>'conversation_id','direction',d->>'direction','at',_event->>'occurred_at','note',coalesce(d->>'text',''),'status',coalesce(d->>'status',CASE d->>'direction' WHEN 'inbound' THEN 'received' ELSE 'queued' END),'media',coalesce(d->'media','[]'::jsonb))::text);
 IF d->>'direction'='inbound' THEN PERFORM lead_private.ml_wa_notify(lid,'message','message:'||mid); END IF;
 END IF;
 END IF;
 outcome=jsonb_build_object('ok',true,'status','linked','lead_id',lid);
 INSERT INTO public.alixsmart_events(external_id,event_type,event_at,payload) VALUES('ml-chat:event:'||eid,_event->>'event',(_event->>'occurred_at')::timestamptz,jsonb_build_object('request_hash',hash,'result',outcome));
 RETURN outcome;
END $$;
REVOKE ALL ON FUNCTION lead_private.ml_wa_chat_event(jsonb) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION lead_private.ml_wa_chat_event(jsonb) TO service_role;
CREATE OR REPLACE FUNCTION public.ml_wa_chat_event(_event jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path=public AS $$ SELECT lead_private.ml_wa_chat_event(_event) $$;
REVOKE ALL ON FUNCTION public.ml_wa_chat_event(jsonb) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.ml_wa_chat_event(jsonb) TO service_role;