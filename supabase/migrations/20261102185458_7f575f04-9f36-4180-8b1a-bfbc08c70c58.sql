CREATE OR REPLACE FUNCTION lead_private.ml_prepare_customer(_lead_id uuid,_create boolean DEFAULT false) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE l public.sales_leads; cid uuid; ids uuid[]; src text; addr jsonb; BEGIN
 IF NOT public.ml_can_access(_lead_id) THEN RAISE EXCEPTION 'Lead nicht zugänglich' USING ERRCODE='42501'; END IF;
 SELECT * INTO l FROM public.sales_leads WHERE id=_lead_id FOR UPDATE;
 IF NOT public.ml_can_access(_lead_id) THEN RAISE EXCEPTION 'Zuweisung geändert' USING ERRCODE='42501'; END IF;
 IF l.converted_customer_id IS NOT NULL THEN RETURN l.converted_customer_id; END IF;
 IF l.tenant_id IS NULL THEN RAISE EXCEPTION 'Zuerst Mandant bestätigen'; END IF;
 SELECT zoho_source_system INTO src FROM public.tenants WHERE id=l.tenant_id AND is_active;
 IF src IS NULL THEN RAISE EXCEPTION 'Für diesen Mandanten fehlt die eindeutige Kundenquelle; Administrator muss Kunden zuordnen'; END IF;
 IF coalesce(trim(l.email),'')<>'' THEN SELECT array_agg(id) INTO ids FROM public.customers WHERE lower(trim(email))=lower(trim(l.email)) AND source_system=src; END IF;
 IF cardinality(ids)>1 THEN RAISE EXCEPTION 'Mehrere passende Kunden; Administrator muss Zuordnung klären'; END IF;
 IF cardinality(ids)=1 THEN cid=ids[1];
 ELSE
 IF NOT _create THEN RAISE EXCEPTION 'Kein eindeutig passender Kunde. Neue Kundenanlage bitte bestätigen.'; END IF;
 addr=jsonb_build_object('address',l.street,'zip',l.zip,'city',l.city,'country',l.country);
 INSERT INTO public.customers(company_name,contact_name,email,phone,billing_address,shipping_address,source_system,external_customer_id)
 VALUES(coalesce(nullif(l.company,''),nullif(trim(coalesce(l.first_name,'')||' '||coalesce(l.last_name,'')),''),'Lead '||l.id::text),trim(coalesce(l.first_name,'')||' '||coalesce(l.last_name,'')),l.email,l.phone,addr,addr,src,'lead-'||l.id::text) RETURNING id INTO cid;
 END IF;
 UPDATE public.sales_leads SET converted_customer_id=cid WHERE id=l.id;
 INSERT INTO public.sales_lead_history(lead_id,action,user_id,note) VALUES(l.id,'customer_linked',auth.uid(),'Kunde eindeutig verknüpft');
 RETURN cid; END $$;
REVOKE ALL ON FUNCTION lead_private.ml_prepare_customer(uuid,boolean) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION lead_private.ml_prepare_customer(uuid,boolean) TO authenticated;
CREATE FUNCTION public.ml_prepare_customer(_lead_id uuid,_create boolean DEFAULT false) RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path=public AS $$ SELECT lead_private.ml_prepare_customer(_lead_id,_create) $$;
REVOKE ALL ON FUNCTION public.ml_prepare_customer(uuid,boolean) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.ml_prepare_customer(uuid,boolean) TO authenticated;