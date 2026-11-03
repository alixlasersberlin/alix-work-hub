CREATE OR REPLACE FUNCTION public.ml_admin_archive_lead(_lead_id uuid, _archived boolean DEFAULT true) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF NOT lead_private.ml_super_admin() THEN RAISE EXCEPTION 'Nur Super Admin' USING ERRCODE='42501'; END IF;
 UPDATE public.sales_leads SET archived=_archived WHERE id=_lead_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Lead nicht gefunden'; END IF;
 INSERT INTO public.sales_lead_history(lead_id,action,user_id,note) VALUES(_lead_id,CASE WHEN _archived THEN 'archived' ELSE 'unarchived' END,auth.uid(),NULL);
END $$;
CREATE OR REPLACE FUNCTION public.ml_admin_delete_lead(_lead_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF NOT lead_private.ml_super_admin() THEN RAISE EXCEPTION 'Nur Super Admin' USING ERRCODE='42501'; END IF;
 DELETE FROM public.sales_leads WHERE id=_lead_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Lead nicht gefunden'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.ml_admin_archive_lead(uuid,boolean) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.ml_admin_delete_lead(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ml_admin_archive_lead(uuid,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ml_admin_delete_lead(uuid) TO authenticated;