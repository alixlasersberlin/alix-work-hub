CREATE OR REPLACE FUNCTION lead_private.ml_offer_link_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE lid uuid; BEGIN
 IF TG_OP='UPDATE' AND OLD.payload->>'lead_id' IS NOT NULL AND NEW.payload->>'lead_id' IS DISTINCT FROM OLD.payload->>'lead_id' THEN RAISE EXCEPTION 'Leadzuordnung darf nicht entfernt oder ersetzt werden'; END IF;
 IF NEW.payload->>'lead_id' IS NULL THEN RETURN NEW; END IF;
 lid=(NEW.payload->>'lead_id')::uuid;
 IF auth.uid() IS NOT NULL AND NOT public.ml_can_access(lid) THEN RAISE EXCEPTION 'Lead nicht zugänglich' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.sales_leads WHERE id=lid) THEN RAISE EXCEPTION 'Lead existiert nicht'; END IF;
 RETURN NEW;
 END $$;
REVOKE ALL ON FUNCTION lead_private.ml_offer_link_guard() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER ml_offer_link_guard BEFORE INSERT OR UPDATE OF payload ON public.offers FOR EACH ROW EXECUTE FUNCTION lead_private.ml_offer_link_guard();
CREATE OR REPLACE FUNCTION lead_private.ml_offer_link_saved() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE lid uuid; BEGIN
 IF NEW.payload->>'lead_id' IS NULL THEN RETURN NEW; END IF;
 lid=(NEW.payload->>'lead_id')::uuid;
 UPDATE public.sales_leads SET converted_offer_id=NEW.id WHERE id=lid AND converted_offer_id IS NULL;
 IF TG_OP='INSERT' THEN INSERT INTO public.sales_lead_history(lead_id,action,user_id,note) VALUES(lid,'offer_saved',auth.uid(),NEW.offer_number);
 ELSIF OLD.status IS DISTINCT FROM NEW.status THEN INSERT INTO public.sales_lead_history(lead_id,action,user_id,note) VALUES(lid,'offer_status',auth.uid(),NEW.offer_number||': '||NEW.status); END IF;
 RETURN NEW;
 END $$;
REVOKE ALL ON FUNCTION lead_private.ml_offer_link_saved() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER ml_offer_link_saved AFTER INSERT OR UPDATE ON public.offers FOR EACH ROW EXECUTE FUNCTION lead_private.ml_offer_link_saved();
CREATE OR REPLACE FUNCTION lead_private.ml_stats() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Anmeldung erforderlich' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('open_offers',(SELECT count(*) FROM public.offers o WHERE coalesce(o.status,'draft') NOT IN ('order','signed','storniert','abgelehnt','expired','abgelaufen') AND EXISTS(SELECT 1 FROM public.sales_leads l WHERE public.ml_can_access(l.id) AND (o.id=l.converted_offer_id OR o.payload->>'lead_id'=l.id::text))),
 'order_value',(SELECT coalesce(sum(o.total_amount),0) FROM public.orders o WHERE EXISTS(SELECT 1 FROM public.sales_leads l JOIN public.offers f ON (f.id=l.converted_offer_id OR f.payload->>'lead_id'=l.id::text) WHERE public.ml_can_access(l.id) AND (o.raw_data->>'offer_number'=f.offer_number OR o.raw_data->>'source_offer'=f.offer_number OR o.raw_data->>'source_offer_number'=f.offer_number))),
 'orders',(SELECT count(*) FROM public.orders o WHERE EXISTS(SELECT 1 FROM public.sales_leads l JOIN public.offers f ON (f.id=l.converted_offer_id OR f.payload->>'lead_id'=l.id::text) WHERE public.ml_can_access(l.id) AND (o.raw_data->>'offer_number'=f.offer_number OR o.raw_data->>'source_offer'=f.offer_number OR o.raw_data->>'source_offer_number'=f.offer_number)))); END $$;
REVOKE ALL ON FUNCTION lead_private.ml_stats() FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION lead_private.ml_stats() TO authenticated;
CREATE FUNCTION public.ml_stats() RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$ SELECT lead_private.ml_stats() $$;
REVOKE ALL ON FUNCTION public.ml_stats() FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.ml_stats() TO authenticated;