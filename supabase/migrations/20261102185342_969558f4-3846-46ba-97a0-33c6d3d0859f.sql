CREATE OR REPLACE FUNCTION lead_private.ml_offer_link_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE lid uuid; BEGIN
 IF TG_OP='UPDATE' AND OLD.payload->>'lead_id' IS NOT NULL AND NEW.payload->>'lead_id' IS DISTINCT FROM OLD.payload->>'lead_id' THEN RAISE EXCEPTION 'Leadzuordnung darf nicht entfernt oder ersetzt werden'; END IF;
 IF NEW.payload->>'lead_id' IS NULL THEN RETURN NEW; END IF;
 lid=(NEW.payload->>'lead_id')::uuid;
 IF auth.uid() IS NOT NULL AND NOT public.ml_can_access(lid) THEN RAISE EXCEPTION 'Lead nicht zugänglich' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.sales_leads WHERE id=lid) THEN RAISE EXCEPTION 'Lead existiert nicht'; END IF;
 IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
 IF TG_OP='INSERT' AND (coalesce(NEW.approval_status,'pending')<>'pending' OR coalesce(NEW.status,'draft')<>'draft' OR NEW.signed_at IS NOT NULL OR NEW.approved_by IS NOT NULL) THEN RAISE EXCEPTION 'Angebotsfreigabe nur durch Administrator'; END IF;
 IF TG_OP='UPDATE' AND (NEW.approval_status IS DISTINCT FROM OLD.approval_status OR NEW.approved_by IS DISTINCT FROM OLD.approved_by OR NEW.approved_at IS DISTINCT FROM OLD.approved_at OR NEW.signed_at IS DISTINCT FROM OLD.signed_at OR NEW.status IS DISTINCT FROM OLD.status) THEN RAISE EXCEPTION 'Freigabe und Annahme dürfen nicht manuell verändert werden'; END IF;
 END IF;
 RETURN NEW;
 END $$;
CREATE POLICY ml_documents_append_only ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated USING(bucket_id<>'inbox-media' OR name NOT LIKE 'leads/%') WITH CHECK(bucket_id<>'inbox-media' OR name NOT LIKE 'leads/%');
CREATE POLICY ml_history_append_only ON public.sales_lead_history AS RESTRICTIVE FOR DELETE TO authenticated USING(false);
CREATE OR REPLACE FUNCTION lead_private.ml_customer_access(_customer_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM public.sales_leads l WHERE l.converted_customer_id=_customer_id AND l.assigned_user=auth.uid() AND public.ml_can_access(l.id)) $$;
REVOKE ALL ON FUNCTION lead_private.ml_customer_access(uuid) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION lead_private.ml_customer_access(uuid) TO authenticated;
CREATE FUNCTION public.ml_customer_access(_customer_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$ SELECT lead_private.ml_customer_access(_customer_id) $$;
REVOKE ALL ON FUNCTION public.ml_customer_access(uuid) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.ml_customer_access(uuid) TO authenticated;
ALTER POLICY ml_customer_select ON public.customers USING(public.ml_customer_access(id));