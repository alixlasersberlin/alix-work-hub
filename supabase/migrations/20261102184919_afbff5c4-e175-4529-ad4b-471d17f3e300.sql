CREATE OR REPLACE FUNCTION public.ml_can_access(_lead_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM public.user_profiles p WHERE p.id=auth.uid() AND p.is_active AND p.account_status='active' AND p.invitation_status='accepted' AND NOT coalesce(p.password_reset_required,true)) AND EXISTS(SELECT 1 FROM public.sales_leads l WHERE l.id=_lead_id AND (public.is_admin() OR (l.assigned_user=auth.uid() AND l.tenant_id IS NOT NULL AND public.user_has_tenant(l.tenant_id))));
$$;
REVOKE ALL ON FUNCTION public.ml_can_access(uuid) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.ml_can_access(uuid) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.ml_list(_offset integer DEFAULT 0,_limit integer DEFAULT 200) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Anmeldung erforderlich' USING ERRCODE='42501'; END IF;
 IF _offset<0 OR _limit<1 OR _limit>200 THEN RAISE EXCEPTION 'Ungültige Seitengröße'; END IF;
 RETURN coalesce((SELECT jsonb_agg(x.row) FROM(SELECT to_jsonb(l)-'metadata' || jsonb_build_object('workspace',coalesce(l.metadata->'lead_workspace','{}'::jsonb),'followups',coalesce((SELECT jsonb_agg(to_jsonb(f)) FROM public.sales_followups f WHERE f.lead_id=l.id),'[]'::jsonb)) AS row FROM public.sales_leads l WHERE public.ml_can_access(l.id) ORDER BY l.created_at DESC,l.id OFFSET _offset LIMIT _limit)x),'[]'::jsonb);
 END $$;
REVOKE ALL ON FUNCTION public.ml_list(integer,integer) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.ml_list(integer,integer) TO authenticated;
CREATE OR REPLACE FUNCTION public.ml_detail(_lead_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$ DECLARE result jsonb; BEGIN
 IF NOT public.ml_can_access(_lead_id) THEN RAISE EXCEPTION 'Lead nicht zugänglich oder Mandant ungeklärt' USING ERRCODE='42501'; END IF;
 SELECT jsonb_build_object('lead',to_jsonb(l)-'metadata','workspace',coalesce(l.metadata->'lead_workspace','{}'::jsonb),
 'history',coalesce((SELECT jsonb_agg(to_jsonb(h) ORDER BY h.created_at DESC) FROM public.sales_lead_history h WHERE h.lead_id=l.id),'[]'::jsonb),
 'followups',coalesce((SELECT jsonb_agg(to_jsonb(f) ORDER BY f.due_at) FROM public.sales_followups f WHERE f.lead_id=l.id),'[]'::jsonb),
 'offers',coalesce((SELECT jsonb_agg(jsonb_build_object('id',o.id,'offer_number',o.offer_number,'offer_date',o.offer_date,'total_gross',o.total_gross,'status',o.status,'approval_status',o.approval_status,'payload',o.payload) ORDER BY o.created_at DESC) FROM public.offers o WHERE o.id=l.converted_offer_id OR o.payload->>'lead_id'=l.id::text),'[]'::jsonb),
 'orders',coalesce((SELECT jsonb_agg(jsonb_build_object('id',o.id,'order_number',o.order_number,'order_date',o.order_date,'total_amount',o.total_amount,'order_status',o.order_status,'source_system',o.source_system,'payment_status',o.raw_data->>'payment_status','delivery_status',o.raw_data->>'delivery_status')) FROM public.orders o WHERE EXISTS(SELECT 1 FROM public.offers f WHERE (f.id=l.converted_offer_id OR f.payload->>'lead_id'=l.id::text) AND (o.raw_data->>'offer_number'=f.offer_number OR o.raw_data->>'source_offer'=f.offer_number OR o.raw_data->>'source_offer_number'=f.offer_number))),'[]'::jsonb)) INTO result FROM public.sales_leads l WHERE l.id=_lead_id;
 RETURN result;
 END $$;
REVOKE ALL ON FUNCTION public.ml_detail(uuid) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.ml_detail(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.ml_action(_lead_id uuid,_action text,_data jsonb DEFAULT '{}'::jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE l public.sales_leads; w jsonb; note text; doc jsonb; BEGIN
 IF NOT public.ml_can_access(_lead_id) THEN RAISE EXCEPTION 'Lead nicht zugänglich oder Mandant ungeklärt' USING ERRCODE='42501'; END IF;
 SELECT * INTO l FROM public.sales_leads WHERE id=_lead_id FOR UPDATE;
 IF NOT public.ml_can_access(_lead_id) THEN RAISE EXCEPTION 'Zuweisung geändert' USING ERRCODE='42501'; END IF;
 IF jsonb_typeof(_data)<>'object' OR octet_length(_data::text)>65536 THEN RAISE EXCEPTION 'Ungültige Eingabe'; END IF;
 w=coalesce(l.metadata->'lead_workspace','{}'::jsonb);
 IF _action='activity' THEN
 IF coalesce(_data->>'channel','') NOT IN ('Telefon','WhatsApp','E-Mail','Video','Persönlich','Notiz') OR length(trim(coalesce(_data->>'note','')))=0 OR length(_data->>'note')>10000 THEN RAISE EXCEPTION 'Kontaktart und Notiz erforderlich'; END IF;
 note=(_data || jsonb_build_object('version',1,'at',now(),'user_id',auth.uid()))::text;
 INSERT INTO public.sales_lead_history(lead_id,action,user_id,note) VALUES(_lead_id,'contact_activity',auth.uid(),note);
 w=w || jsonb_build_object('last_activity_at',now(),'next_action',coalesce(_data->>'next_action',''));
 ELSIF _action='status' THEN
 IF coalesce(_data->>'status','') NOT IN ('Neu','Kontaktaufnahme läuft','Kunde erreicht','Beratung läuft','Angebot in Vorbereitung','Angebot versendet','Nachverhandlung','Auftrag erhalten','Gewonnen','Verloren') THEN RAISE EXCEPTION 'Ungültiger Status'; END IF;
 UPDATE public.sales_leads SET lead_status=_data->>'status' WHERE id=_lead_id;
 w=w || jsonb_build_object('last_activity_at',now());
 ELSIF _action='followup' THEN
 IF length(trim(coalesce(_data->>'title','')))=0 OR length(_data->>'title')>250 OR coalesce(_data->>'due_at','')='' THEN RAISE EXCEPTION 'Anlass und Termin erforderlich'; END IF;
 INSERT INTO public.sales_followups(lead_id,type,title,description,due_at,assigned_user,created_by) VALUES(_lead_id,'Rückruf',_data->>'title',left(_data->>'note',10000),(_data->>'due_at')::timestamptz,l.assigned_user,auth.uid());
 INSERT INTO public.sales_lead_history(lead_id,action,user_id,note) VALUES(_lead_id,'followup_created',auth.uid(),_data::text);
 ELSIF _action='followup_done' THEN
 UPDATE public.sales_followups SET status='Erledigt',done_at=now() WHERE id=(_data->>'id')::uuid AND lead_id=_lead_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Wiedervorlage nicht zugänglich'; END IF;
 INSERT INTO public.sales_lead_history(lead_id,action,user_id,note) VALUES(_lead_id,'followup_done',auth.uid(),'Wiedervorlage erledigt');
 ELSIF _action='preferences' THEN
 IF coalesce(_data->>'priority','Normal') NOT IN ('Niedrig','Normal','Hoch','Dringend') THEN RAISE EXCEPTION 'Ungültige Priorität'; END IF;
 w=w || jsonb_build_object('priority',coalesce(_data->>'priority','Normal'),'offer_information',_data->'offer_information','next_action',left(coalesce(_data->>'next_action',''),2000));
 INSERT INTO public.sales_lead_history(lead_id,action,user_id,note) VALUES(_lead_id,'preferences_changed',auth.uid(),'Bearbeitungsinformationen aktualisiert');
 ELSIF _action='document' THEN
 IF coalesce(_data->>'path','') NOT LIKE ('leads/'||_lead_id::text||'/%') OR length(coalesce(_data->>'name',''))=0 OR NOT EXISTS(SELECT 1 FROM storage.objects s WHERE s.bucket_id='inbox-media' AND s.name=_data->>'path') THEN RAISE EXCEPTION 'Dokument nicht zugänglich'; END IF;
 doc=jsonb_build_object('path',_data->>'path','name',left(_data->>'name',255),'at',now(),'user_id',auth.uid());
 w=w || jsonb_build_object('documents',coalesce(w->'documents','[]'::jsonb)||jsonb_build_array(doc));
 INSERT INTO public.sales_lead_history(lead_id,action,user_id,note) VALUES(_lead_id,'document_added',auth.uid(),doc::text);
 ELSIF _action='tenant' THEN
 IF NOT public.is_admin() THEN RAISE EXCEPTION 'Nur Admin darf Mandanten zuordnen' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.tenants t WHERE t.id=(_data->>'tenant_id')::uuid AND t.is_active) THEN RAISE EXCEPTION 'Mandant ungültig'; END IF;
 UPDATE public.sales_leads SET tenant_id=(_data->>'tenant_id')::uuid WHERE id=_lead_id;
 INSERT INTO public.sales_lead_history(lead_id,action,user_id,note) VALUES(_lead_id,'tenant_assigned',auth.uid(),_data::text);
 ELSE RAISE EXCEPTION 'Unbekannte Aktion'; END IF;
 UPDATE public.sales_leads SET metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('lead_workspace',w) WHERE id=_lead_id;
 RETURN public.ml_detail(_lead_id);
 END $$;
REVOKE ALL ON FUNCTION public.ml_action(uuid,text,jsonb) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.ml_action(uuid,text,jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.ml_storage_access(_name text) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF _name !~ '^leads/[0-9a-fA-F-]{36}/[^/]+$' THEN RETURN false; END IF;
 RETURN public.ml_can_access(split_part(_name,'/',2)::uuid);
 EXCEPTION WHEN invalid_text_representation THEN RETURN false; END $$;
REVOKE ALL ON FUNCTION public.ml_storage_access(text) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.ml_storage_access(text) TO authenticated;
CREATE POLICY ml_documents_read_gate ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated USING(bucket_id<>'inbox-media' OR name NOT LIKE 'leads/%' OR public.ml_storage_access(name));
CREATE POLICY ml_documents_insert_gate ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(bucket_id<>'inbox-media' OR name NOT LIKE 'leads/%' OR public.ml_storage_access(name));
CREATE POLICY ml_documents_update_gate ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated USING(bucket_id<>'inbox-media' OR name NOT LIKE 'leads/%' OR public.ml_storage_access(name)) WITH CHECK(bucket_id<>'inbox-media' OR name NOT LIKE 'leads/%' OR public.ml_storage_access(name));
CREATE POLICY ml_documents_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id='inbox-media' AND public.ml_storage_access(name));
CREATE POLICY ml_documents_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='inbox-media' AND public.ml_storage_access(name));