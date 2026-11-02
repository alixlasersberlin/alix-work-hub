CREATE UNIQUE INDEX IF NOT EXISTS ml_wa_contact_unique ON public.sales_leads ((metadata->'whatsapp_sales'->>'contact_id'),tenant_id) WHERE metadata->'whatsapp_sales'->>'contact_id' IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ml_wa_conversation_unique ON public.sales_leads ((metadata->'whatsapp_sales'->>'conversation_id'),tenant_id) WHERE metadata->'whatsapp_sales'->>'conversation_id' IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ml_notification_unique ON public.app_notifications(user_id,(metadata->>'ml_dedup_key')) WHERE metadata->>'ml_dedup_key' IS NOT NULL;
CREATE FUNCTION lead_private.ml_wa_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT auth.uid() IS NOT NULL AND public.is_admin() AND EXISTS(SELECT 1 FROM public.user_profiles WHERE id=auth.uid() AND is_active AND account_status='active' AND invitation_status='accepted' AND NOT password_reset_required) $$;
REVOKE ALL ON FUNCTION lead_private.ml_wa_admin() FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION lead_private.ml_wa_admin() TO authenticated,service_role;
CREATE FUNCTION lead_private.ml_wa_notify(_lead uuid,_kind text,_key text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE l public.sales_leads; BEGIN
 SELECT * INTO l FROM public.sales_leads WHERE id=_lead;
 INSERT INTO public.app_notifications(user_id,category,title,message,action_url,metadata)
 SELECT DISTINCT p.id,'sales_lead',CASE _kind WHEN 'assigned' THEN 'Neuer Lead zugewiesen' WHEN 'message' THEN 'Neue WhatsApp-Nachricht' WHEN '24h' THEN 'Lead seit 24 Stunden unbearbeitet' WHEN 'followup' THEN 'Wiedervorlage überfällig' ELSE 'Neuer WhatsApp-Lead' END,
 'Lead '||coalesce(l.lead_number,l.id::text),CASE WHEN l.assigned_user IS NULL THEN '/vertrieb/whatsapp-eingang' ELSE '/vertrieb/meine-leads/'||l.id END,jsonb_build_object('lead_id',l.id,'ml_dedup_key',_key,'kind',_kind)
 FROM public.user_profiles p WHERE p.is_active AND p.account_status='active' AND p.invitation_status='accepted' AND NOT p.password_reset_required AND
 ((l.assigned_user IS NOT NULL AND p.id=l.assigned_user AND EXISTS(SELECT 1 FROM public.user_tenant_access a WHERE a.user_id=p.id AND a.tenant_id=l.tenant_id)) OR
 (l.assigned_user IS NULL AND EXISTS(SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id=ur.role_id WHERE ur.user_id=p.id AND r.name IN ('Admin','Super Admin'))))
 ON CONFLICT DO NOTHING;
 END $$;
REVOKE ALL ON FUNCTION lead_private.ml_wa_notify(uuid,text,text) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION lead_private.ml_wa_ingest(_event jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE
 d jsonb; tid uuid; lid uuid; ids uuid[]; cid uuid; customer_ids uuid[]; eid text; mid text; signature text; old jsonb; outcome jsonb; w jsonb; is_new boolean=false; src text;
 BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Nur autorisierte Integration' USING ERRCODE='42501'; END IF;
 IF jsonb_typeof(_event)<>'object' OR octet_length(_event::text)>65536 OR _event->>'event'<>'sales.whatsapp.inbound' THEN RAISE EXCEPTION 'Ungültiges Ereignis'; END IF;
 d=_event->'data'; tid=(d->>'tenant_id')::uuid; eid=_event->>'event_id'; mid=d->>'message_id';
 IF coalesce(eid,'')='' OR coalesce(mid,'')='' OR coalesce(d->>'contact_id','')='' OR coalesce(d->>'conversation_id','')='' OR coalesce(d->>'phone','') !~ '^\+[1-9][0-9]{7,14}$' OR d->>'direction'<>'inbound' OR d->>'area'<>'sales' OR coalesce(d->>'relevance','') NOT IN ('sales','service','spam','internal','unknown') THEN RAISE EXCEPTION 'Unvollständige WhatsApp-Zuordnung'; END IF;
 SELECT zoho_source_system INTO src FROM public.tenants WHERE id=tid AND is_active;
 IF src IS NULL THEN RAISE EXCEPTION 'Unbestätigter Mandant'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('ml-wa-ingestion-v1',0));
 signature=md5(_event::text);
 SELECT payload INTO old FROM public.alixsmart_events WHERE external_id='ml-wa:event:'||eid;
 IF old IS NOT NULL THEN
 IF old->>'request_hash' IS DISTINCT FROM signature THEN RAISE EXCEPTION 'Ereignis-ID bereits mit anderem Inhalt verwendet'; END IF;
 RETURN old->'result'||jsonb_build_object('deduped',true); END IF;
 SELECT payload INTO old FROM public.alixsmart_events WHERE external_id='ml-wa:message:'||mid;
 IF old IS NOT NULL THEN
 IF old->>'data_hash' IS DISTINCT FROM md5(d::text) THEN RAISE EXCEPTION 'Nachrichten-ID bereits mit anderem Inhalt verwendet'; END IF;
 RETURN old->'result'||jsonb_build_object('deduped',true); END IF;
 SELECT array_agg(id) INTO ids FROM public.sales_leads WHERE tenant_id=tid AND (metadata->'whatsapp_sales'->>'contact_id'=d->>'contact_id' OR metadata->'whatsapp_sales'->>'conversation_id'=d->>'conversation_id');
 IF cardinality(ids)>1 THEN outcome=jsonb_build_object('ok',true,'status','needs_review','reason','ambiguous_identity');
 ELSIF cardinality(ids)=1 THEN lid=ids[1];
 IF EXISTS(SELECT 1 FROM public.sales_leads WHERE id=lid AND (metadata->'whatsapp_sales'->>'contact_id' IS DISTINCT FROM d->>'contact_id' OR metadata->'whatsapp_sales'->>'conversation_id' IS DISTINCT FROM d->>'conversation_id')) THEN lid=NULL; outcome=jsonb_build_object('ok',true,'status','needs_review','reason','identity_conflict'); END IF;
 ELSE
 SELECT array_agg(id) INTO ids FROM public.sales_leads WHERE tenant_id=tid AND NOT archived AND regexp_replace(coalesce(phone,''),'[^0-9]','','g')=regexp_replace(d->>'phone','[^0-9]','','g');
 IF cardinality(ids)>0 THEN outcome=jsonb_build_object('ok',true,'status','needs_review','reason','phone_match_requires_identity_confirmation'); END IF;
 END IF;
 IF lid IS NULL AND outcome IS NULL THEN
 IF d->>'relevance'<>'sales' THEN outcome=jsonb_build_object('ok',true,'status','ignored','reason',d->>'relevance');
 ELSE
 SELECT array_agg(id) INTO customer_ids FROM public.customers WHERE source_system=src AND regexp_replace(coalesce(phone,''),'[^0-9]','','g')=regexp_replace(d->>'phone','[^0-9]','','g');
 IF cardinality(customer_ids)>1 THEN outcome=jsonb_build_object('ok',true,'status','needs_review','reason','ambiguous_customer');
 ELSE
 IF cardinality(customer_ids)=1 THEN cid=customer_ids[1]; END IF;
 INSERT INTO public.sales_leads(source,external_id,form_name,first_name,phone,message,created_at,tenant_id,assigned_user,lead_status,requested_products,converted_customer_id,metadata)
 VALUES('whatsapp_sales','alixsmart-wa:'||tid||':'||(d->>'contact_id'),'WhatsApp Sales',left(d->>'name',250),d->>'phone',left(d->>'text',10000),(_event->>'occurred_at')::timestamptz,tid,NULL,'Neu',left(d->>'product_interest',1000),cid,
 jsonb_build_object('whatsapp_sales',jsonb_build_object('version',1,'contact_id',d->>'contact_id','conversation_id',d->>'conversation_id','language',d->>'language','first_message_id',mid),'lead_workspace',jsonb_build_object('priority',CASE d->>'priority' WHEN 'Hoch' THEN 'Hoch' WHEN 'Niedrig' THEN 'Niedrig' ELSE 'Normal' END,'recommended_priority',d->>'priority'))) RETURNING id INTO lid;
 is_new=true;
 END IF; END IF; END IF;
 IF lid IS NOT NULL THEN
 SELECT metadata->'whatsapp_sales' INTO w FROM public.sales_leads WHERE id=lid FOR UPDATE;
 IF coalesce((w->>'last_message_at')::timestamptz,'-infinity'::timestamptz)<=(_event->>'occurred_at')::timestamptz THEN
 UPDATE public.sales_leads SET metadata=metadata||jsonb_build_object('whatsapp_sales',w||jsonb_build_object('last_message',left(d->>'text',500),'last_message_at',_event->>'occurred_at','last_message_id',mid)) WHERE id=lid;
 END IF;
 INSERT INTO public.sales_lead_history(lead_id,action,note) VALUES(lid,'whatsapp_received',jsonb_build_object('message_id',mid,'conversation_id',d->>'conversation_id','at',_event->>'occurred_at','note',left(d->>'text',10000))::text);
 PERFORM lead_private.ml_wa_notify(lid,CASE WHEN is_new THEN 'new' ELSE 'message' END,'message:'||mid);
 outcome=jsonb_build_object('ok',true,'status',CASE WHEN is_new THEN 'created' ELSE 'linked' END,'lead_id',lid);
 END IF;
 INSERT INTO public.alixsmart_events(external_id,event_type,event_at,payload) VALUES('ml-wa:event:'||eid,'sales.whatsapp.inbound',(_event->>'occurred_at')::timestamptz,jsonb_build_object('request_hash',signature,'result',outcome,'data',d));
 INSERT INTO public.alixsmart_events(external_id,event_type,event_at,payload) VALUES('ml-wa:message:'||mid,'sales.whatsapp.message',(_event->>'occurred_at')::timestamptz,jsonb_build_object('data_hash',md5(d::text),'result',outcome));
 RETURN outcome; END $$;
REVOKE ALL ON FUNCTION lead_private.ml_wa_ingest(jsonb) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION lead_private.ml_wa_ingest(jsonb) TO service_role;
CREATE FUNCTION public.ml_wa_ingest(_event jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path=public AS $$ SELECT lead_private.ml_wa_ingest(_event) $$;
REVOKE ALL ON FUNCTION public.ml_wa_ingest(jsonb) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.ml_wa_ingest(jsonb) TO service_role;
CREATE FUNCTION lead_private.ml_wa_inbox(_offset integer DEFAULT 0) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF NOT lead_private.ml_wa_admin() THEN RAISE EXCEPTION 'Nur Admin und Super Admin' USING ERRCODE='42501'; END IF;
 IF _offset<0 THEN RAISE EXCEPTION 'Ungültige Seite'; END IF;
 RETURN coalesce((SELECT jsonb_agg(x.row) FROM (SELECT to_jsonb(l)-'metadata'||jsonb_build_object('workspace',l.metadata->'lead_workspace','whatsapp',l.metadata->'whatsapp_sales') row FROM public.sales_leads l WHERE source='whatsapp_sales' AND assigned_user IS NULL AND NOT archived ORDER BY created_at DESC,id OFFSET _offset LIMIT 200)x),'[]'::jsonb); END $$;
CREATE FUNCTION public.ml_wa_inbox(_offset integer DEFAULT 0) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$ SELECT lead_private.ml_wa_inbox(_offset) $$;
CREATE FUNCTION lead_private.ml_wa_assignees(_tenant uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF NOT lead_private.ml_wa_admin() THEN RAISE EXCEPTION 'Nur Admin und Super Admin' USING ERRCODE='42501'; END IF;
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id',p.id,'name',coalesce(p.full_name,p.email))) FROM public.user_profiles p WHERE p.is_active AND p.account_status='active' AND p.invitation_status='accepted' AND NOT p.password_reset_required AND EXISTS(SELECT 1 FROM public.user_tenant_access a WHERE a.user_id=p.id AND a.tenant_id=_tenant)),'[]'::jsonb); END $$;
CREATE FUNCTION public.ml_wa_assignees(_tenant uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$ SELECT lead_private.ml_wa_assignees(_tenant) $$;
CREATE FUNCTION lead_private.ml_wa_assign(_lead uuid,_user uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE l public.sales_leads; BEGIN
 IF NOT lead_private.ml_wa_admin() THEN RAISE EXCEPTION 'Nur Admin und Super Admin' USING ERRCODE='42501'; END IF;
 SELECT * INTO l FROM public.sales_leads WHERE id=_lead FOR UPDATE;
 IF NOT FOUND OR l.source<>'whatsapp_sales' OR l.assigned_user IS NOT NULL OR l.archived THEN RAISE EXCEPTION 'Lead nicht mehr im Eingang'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.user_profiles p JOIN public.user_tenant_access a ON a.user_id=p.id WHERE p.id=_user AND p.is_active AND p.account_status='active' AND p.invitation_status='accepted' AND NOT p.password_reset_required AND a.tenant_id=l.tenant_id) THEN RAISE EXCEPTION 'Mitarbeiter nicht für diesen Mandanten freigegeben'; END IF;
 UPDATE public.sales_leads SET assigned_user=_user WHERE id=_lead;
 INSERT INTO public.sales_lead_history(lead_id,action,user_id,note) VALUES(_lead,'assigned',auth.uid(),jsonb_build_object('assigned_user',_user)::text);
 PERFORM lead_private.ml_wa_notify(_lead,'assigned','assignment:'||_lead||':'||_user);
 RETURN jsonb_build_object('ok',true,'lead_id',_lead); END $$;
CREATE FUNCTION public.ml_wa_assign(_lead uuid,_user uuid) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path=public AS $$ SELECT lead_private.ml_wa_assign(_lead,_user) $$;
REVOKE ALL ON FUNCTION lead_private.ml_wa_inbox(integer),lead_private.ml_wa_assignees(uuid),lead_private.ml_wa_assign(uuid,uuid),public.ml_wa_inbox(integer),public.ml_wa_assignees(uuid),public.ml_wa_assign(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION lead_private.ml_wa_inbox(integer),lead_private.ml_wa_assignees(uuid),lead_private.ml_wa_assign(uuid,uuid),public.ml_wa_inbox(integer),public.ml_wa_assignees(uuid),public.ml_wa_assign(uuid,uuid) TO authenticated;
CREATE FUNCTION lead_private.ml_wa_due_notifications() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE r record; BEGIN
 FOR r IN SELECT id FROM public.sales_leads WHERE source='whatsapp_sales' AND NOT archived AND lead_status NOT IN ('Gewonnen','Verloren','Archiviert') AND created_at<=now()-interval '24 hours' AND metadata->'lead_workspace'->>'last_activity_at' IS NULL LOOP
 PERFORM lead_private.ml_wa_notify(r.id,'24h','24h:'||r.id); END LOOP;
 FOR r IN SELECT f.id,f.lead_id FROM public.sales_followups f JOIN public.sales_leads l ON l.id=f.lead_id WHERE l.source='whatsapp_sales' AND NOT l.archived AND f.due_at<now() AND f.done_at IS NULL AND coalesce(f.status,'') NOT IN ('Erledigt','done','completed') LOOP
 PERFORM lead_private.ml_wa_notify(r.lead_id,'followup','followup:'||r.id); END LOOP;
 END $$;
REVOKE ALL ON FUNCTION lead_private.ml_wa_due_notifications() FROM PUBLIC,anon,authenticated;
SELECT cron.schedule('ml-wa-time-notifications','0 * * * *','SELECT lead_private.ml_wa_due_notifications()');