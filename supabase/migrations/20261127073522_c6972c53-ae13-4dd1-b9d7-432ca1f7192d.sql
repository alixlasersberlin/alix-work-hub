CREATE FUNCTION public.ph2_release_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE enabled boolean; restricted boolean:=false;
BEGIN
 SELECT coalesce((value->>'enabled')::boolean,false) INTO enabled FROM public.ph_settings WHERE key='ph2_activation';
 IF NOT coalesce(enabled,false) THEN RETURN NEW; END IF;
 IF TG_TABLE_NAME='ph_products' THEN
  IF TG_OP='INSERT' THEN restricted:=NEW.status='published';
  ELSE restricted:=(to_jsonb(OLD)->'active_de') IS DISTINCT FROM (to_jsonb(NEW)->'active_de') OR (to_jsonb(OLD)->'active_com') IS DISTINCT FROM (to_jsonb(NEW)->'active_com') OR (to_jsonb(OLD)->'active_dubai') IS DISTINCT FROM (to_jsonb(NEW)->'active_dubai') OR (to_jsonb(OLD)->'status') IS DISTINCT FROM (to_jsonb(NEW)->'status'); END IF;
 ELSE
  IF TG_OP='UPDATE' THEN restricted:=OLD.hold=true AND NEW.hold=false; END IF;
 END IF;
 IF restricted AND NOT EXISTS(SELECT 1 FROM public.user_profiles p JOIN public.user_roles ur ON ur.user_id=p.id JOIN public.roles r ON r.id=ur.role_id WHERE p.id=auth.uid() AND p.account_status='active' AND p.invitation_status='accepted' AND p.password_reset_required=false AND r.name='Super Admin') THEN RAISE EXCEPTION 'PRODUCT HUB 2.0: Freigabe ausschließlich durch aktiven Super Admin'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.ph2_release_guard() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER ph2_central_release_guard BEFORE INSERT OR UPDATE ON public.ph_products FOR EACH ROW EXECUTE FUNCTION public.ph2_release_guard();
CREATE TRIGGER ph2_hold_release_guard BEFORE UPDATE OF hold ON public.ph_product_channels FOR EACH ROW EXECUTE FUNCTION public.ph2_release_guard();