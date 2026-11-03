CREATE FUNCTION lead_private.ml_super_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT lead_private.ml_wa_admin() AND EXISTS(SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id=ur.role_id WHERE ur.user_id=auth.uid() AND r.name='Super Admin') $$;
REVOKE ALL ON FUNCTION lead_private.ml_super_admin() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION lead_private.ml_super_admin() TO authenticated;
CREATE FUNCTION lead_private.ml_reassign(_lead uuid,_user uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE l public.sales_leads; transferred integer; target_name text;
BEGIN
 IF NOT lead_private.ml_super_admin() THEN RAISE EXCEPTION 'Nur Super Admin darf neu zuweisen' USING ERRCODE='42501'; END IF;
 SELECT * INTO l FROM public.sales_leads WHERE id=_lead FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Lead nicht gefunden'; END IF;
 SELECT p.full_name INTO target_name FROM public.user_profiles p WHERE p.id=_user AND p.is_active AND p.account_status='active' AND p.invitation_status='accepted' AND NOT p.password_reset_required AND EXISTS(SELECT 1 FROM public.user_tenant_access a WHERE a.user_id=p.id AND a.tenant_id=l.tenant_id);
 IF NOT FOUND THEN RAISE EXCEPTION 'Mandant klären und freigegebenen Mitarbeiter dieses Mandanten wählen' USING ERRCODE='42501'; END IF;
 IF EXISTS(SELECT 1 FROM public.offers o WHERE (o.id=l.converted_offer_id OR o.payload->>'lead_id'=l.id::text) AND o.tenant_id IS NOT NULL AND o.tenant_id<>l.tenant_id) THEN RAISE EXCEPTION 'Abweichender Angebotsmandant: Zuordnung zuerst prüfen'; END IF;
 IF l.assigned_user IS NOT DISTINCT FROM _user THEN RETURN jsonb_build_object('ok',true,'unchanged',true); END IF;
 UPDATE public.sales_leads SET assigned_user=_user WHERE id=_lead;
 UPDATE public.sales_followups SET assigned_user=_user WHERE lead_id=_lead AND done_at IS NULL;
 SELECT count(*) INTO transferred FROM public.offers o WHERE o.id=l.converted_offer_id OR o.payload->>'lead_id'=l.id::text;
 INSERT INTO public.sales_lead_history(lead_id,action,user_id,note) VALUES(_lead,'reassigned',auth.uid(),jsonb_build_object('from_user',l.assigned_user,'to_user',_user,'note','Neuzuweisung an '||coalesce(target_name,_user::text),'linked_offers',transferred)::text);
 PERFORM lead_private.ml_wa_notify(_lead,'assigned','reassignment:'||gen_random_uuid()::text);
 RETURN jsonb_build_object('ok',true,'lead_id',_lead,'linked_offers',transferred);
END $$;
CREATE FUNCTION public.ml_reassign(_lead uuid,_user uuid) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path=public AS $$ SELECT lead_private.ml_reassign(_lead,_user) $$;
REVOKE ALL ON FUNCTION lead_private.ml_reassign(uuid,uuid),public.ml_reassign(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION lead_private.ml_reassign(uuid,uuid),public.ml_reassign(uuid,uuid) TO authenticated;
CREATE POLICY ml_offer_update_assigned_lead ON public.offers FOR UPDATE TO authenticated USING(EXISTS(SELECT 1 FROM public.sales_leads l WHERE public.ml_can_access(l.id) AND l.assigned_user=auth.uid() AND (l.converted_offer_id=offers.id OR offers.payload->>'lead_id'=l.id::text))) WITH CHECK(EXISTS(SELECT 1 FROM public.sales_leads l WHERE public.ml_can_access(l.id) AND l.assigned_user=auth.uid() AND (l.converted_offer_id=offers.id OR offers.payload->>'lead_id'=l.id::text)));
DO $$ BEGIN
 IF lead_private.ml_super_admin() THEN RAISE EXCEPTION 'Signed-out caller must not be Super Admin'; END IF;
 BEGIN PERFORM lead_private.ml_reassign(gen_random_uuid(),gen_random_uuid()); RAISE EXCEPTION 'Unauthorized reassignment accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;