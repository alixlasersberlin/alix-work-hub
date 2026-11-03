CREATE FUNCTION lead_private.ml_wa_chat_page(_lead_id uuid,_offset integer DEFAULT 0,_limit integer DEFAULT 50) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb; msgs jsonb; total bigint;
BEGIN
 IF NOT public.ml_can_access(_lead_id) THEN RAISE EXCEPTION 'Lead nicht zugänglich' USING ERRCODE='42501'; END IF;
 IF _offset<0 OR _limit<1 OR _limit>100 THEN RAISE EXCEPTION 'Ungültige Seitengröße'; END IF;
 result=lead_private.ml_wa_chat(_lead_id,NULL,1);
 SELECT count(*) INTO total FROM public.sales_lead_history WHERE lead_id=_lead_id AND action IN ('whatsapp_received','whatsapp_bridge_message');
 SELECT coalesce(jsonb_agg(x.message ORDER BY x.at DESC,x.id DESC),'[]'::jsonb) INTO msgs FROM(
 SELECT h.id,h.created_at at,jsonb_build_object('id',h.note::jsonb->>'message_id','direction',CASE h.action WHEN 'whatsapp_received' THEN 'inbound' ELSE 'outbound' END,'text',h.note::jsonb->>'note','at',coalesce(h.note::jsonb->>'at',h.created_at::text),'status',coalesce(h.note::jsonb->>'status','received'),'media',coalesce(h.note::jsonb->'media','[]'::jsonb)) message FROM public.sales_lead_history h WHERE h.lead_id=_lead_id AND h.action IN ('whatsapp_received','whatsapp_bridge_message') ORDER BY h.created_at DESC,h.id DESC OFFSET _offset LIMIT _limit)x;
 RETURN result||jsonb_build_object('messages',msgs,'has_more',total>_offset+_limit);
END $$;
REVOKE ALL ON FUNCTION lead_private.ml_wa_chat_page(uuid,integer,integer) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION lead_private.ml_wa_chat_page(uuid,integer,integer) TO authenticated;
CREATE FUNCTION public.ml_wa_chat_page(_lead_id uuid,_offset integer DEFAULT 0,_limit integer DEFAULT 50) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$ SELECT lead_private.ml_wa_chat_page(_lead_id,_offset,_limit) $$;
REVOKE ALL ON FUNCTION public.ml_wa_chat_page(uuid,integer,integer) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.ml_wa_chat_page(uuid,integer,integer) TO authenticated;
DO $$ DECLARE lid uuid; tid uuid; event jsonb; result jsonb; n integer;
BEGIN
 BEGIN
 SELECT id INTO tid FROM public.tenants WHERE is_active AND zoho_source_system IS NOT NULL LIMIT 1;
 IF tid IS NULL THEN RAISE EXCEPTION 'No tenant for test'; END IF;
 PERFORM set_config('request.jwt.claim.role','service_role',true);
 INSERT INTO public.sales_leads(source,first_name,tenant_id,lead_status,metadata) VALUES('whatsapp_sales','SYNTHETIC CHAT ROLLBACK',tid,'Neu',jsonb_build_object('whatsapp_sales',jsonb_build_object('contact_id','synthetic-contact','conversation_id','synthetic-conversation'))) RETURNING id INTO lid;
 event=jsonb_build_object('event','sales.whatsapp.message','source','alixsmart','version',1,'event_id','synthetic-event','occurred_at',now(),'data',jsonb_build_object('tenant_id',tid,'contact_id','synthetic-contact','conversation_id','synthetic-conversation','message_id','synthetic-message','area','sales','direction','inbound','text','Test message','status','received'));
 result=lead_private.ml_wa_chat_event(event); IF result->>'lead_id'<>lid::text THEN RAISE EXCEPTION 'Link test failed'; END IF;
 result=lead_private.ml_wa_chat_event(event); IF NOT(result->>'deduped')::boolean THEN RAISE EXCEPTION 'Dedup test failed'; END IF;
 SELECT count(*) INTO n FROM public.sales_lead_history WHERE lead_id=lid AND action='whatsapp_received'; IF n<>1 THEN RAISE EXCEPTION 'Duplicate history'; END IF;
 result=lead_private.ml_wa_chat_event(event||jsonb_build_object('event_id','synthetic-foreign','data',(event->'data')||jsonb_build_object('contact_id','foreign'))); IF result->>'status'<>'needs_review' THEN RAISE EXCEPTION 'Foreign identity accepted'; END IF;
 PERFORM set_config('request.jwt.claim.role','authenticated',true);
 BEGIN PERFORM lead_private.ml_wa_chat_event(event); RAISE EXCEPTION 'Authenticated ingestion accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
 BEGIN PERFORM lead_private.ml_wa_chat_page(lid,0,50); RAISE EXCEPTION 'Foreign chat readable'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 RAISE EXCEPTION 'ROLLBACK_CHAT_FIXTURE' USING ERRCODE='P0002';
 EXCEPTION WHEN no_data_found THEN IF SQLERRM<>'ROLLBACK_CHAT_FIXTURE' THEN RAISE; END IF;
 END;
END $$;