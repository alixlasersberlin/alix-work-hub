CREATE OR REPLACE FUNCTION lead_private.ml_wa_chat(_lead_id uuid,_before timestamptz DEFAULT NULL,_limit integer DEFAULT 50) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE l public.sales_leads; msgs jsonb; more boolean; next_cursor timestamptz;
BEGIN
 IF NOT public.ml_can_access(_lead_id) THEN RAISE EXCEPTION 'Lead nicht zugänglich' USING ERRCODE='42501'; END IF;
 IF _limit<1 OR _limit>100 THEN RAISE EXCEPTION 'Ungültige Seitengröße'; END IF;
 SELECT * INTO l FROM public.sales_leads WHERE id=_lead_id;
 SELECT coalesce(jsonb_agg(x.message ORDER BY x.at DESC,x.id DESC),'[]'::jsonb),min(x.at) INTO msgs,next_cursor FROM (
 SELECT h.id,h.created_at at,jsonb_build_object('id',h.note::jsonb->>'message_id','direction',CASE h.action WHEN 'whatsapp_received' THEN 'inbound' ELSE 'outbound' END,'text',h.note::jsonb->>'note','at',coalesce(h.note::jsonb->>'at',h.created_at::text),'status',coalesce(h.note::jsonb->>'status','received'),'media',coalesce(h.note::jsonb->'media','[]'::jsonb)) message
 FROM public.sales_lead_history h WHERE h.lead_id=_lead_id AND h.action IN ('whatsapp_received','whatsapp_bridge_message') AND (_before IS NULL OR h.created_at<_before)
 ORDER BY h.created_at DESC,h.id DESC LIMIT _limit
 )x;
 SELECT EXISTS(SELECT 1 FROM public.sales_lead_history WHERE lead_id=_lead_id AND action IN ('whatsapp_received','whatsapp_bridge_message') AND created_at<next_cursor) INTO more;
 RETURN jsonb_build_object('linked',l.metadata->'whatsapp_sales'->>'contact_id' IS NOT NULL AND l.metadata->'whatsapp_sales'->>'conversation_id' IS NOT NULL,'contact_id',l.metadata->'whatsapp_sales'->>'contact_id','conversation_id',l.metadata->'whatsapp_sales'->>'conversation_id','tenant_id',l.tenant_id,'messages',msgs,'has_more',more,'next_cursor',next_cursor);
END $$;