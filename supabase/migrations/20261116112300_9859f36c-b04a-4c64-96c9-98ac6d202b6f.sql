INSERT INTO public.roles(name,description) SELECT 'Tickets erstellen','Darf Tickets erstellen und eigene neue Tickets öffnen' WHERE NOT EXISTS(SELECT 1 FROM public.roles WHERE name='Tickets erstellen');
INSERT INTO public.user_roles(user_id,role_id) SELECT '7212fdcc-3bc3-4092-85cc-f96c6821c21e'::uuid,r.id FROM public.roles r WHERE r.name='Tickets erstellen' AND NOT EXISTS(SELECT 1 FROM public.user_roles ur WHERE ur.user_id='7212fdcc-3bc3-4092-85cc-f96c6821c21e' AND ur.role_id=r.id);
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS created_by uuid;
CREATE OR REPLACE FUNCTION public.ticket_creator_active() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM public.user_profiles p JOIN public.user_roles ur ON ur.user_id=p.id JOIN public.roles r ON r.id=ur.role_id WHERE p.id=auth.uid() AND p.is_active AND p.account_status='active' AND p.invitation_status='accepted' AND NOT p.password_reset_required AND r.name='Tickets erstellen') $$;
REVOKE ALL ON FUNCTION public.ticket_creator_active() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ticket_creator_active() TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.ticket_stamp_creator() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
IF TG_OP='INSERT' AND auth.uid() IS NOT NULL THEN NEW.created_by:=auth.uid(); END IF;
IF TG_OP='UPDATE' AND auth.uid() IS NOT NULL AND NEW.created_by IS DISTINCT FROM OLD.created_by THEN RAISE EXCEPTION 'Ticket creator cannot be changed' USING ERRCODE='42501'; END IF;
RETURN NEW; END $$;
CREATE TRIGGER tickets_stamp_creator BEFORE INSERT OR UPDATE OF created_by ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.ticket_stamp_creator();
CREATE POLICY tickets_creator_insert ON public.tickets FOR INSERT TO authenticated WITH CHECK ((SELECT public.ticket_creator_active()) AND created_by=(SELECT auth.uid()) AND source_system='alixwork');
CREATE POLICY tickets_creator_read ON public.tickets FOR SELECT TO authenticated USING ((SELECT public.ticket_creator_active()) AND created_by=(SELECT auth.uid()));
DO $$ DECLARE u uuid; BEGIN
PERFORM set_config('request.jwt.claim.sub','7212fdcc-3bc3-4092-85cc-f96c6821c21e',true);
IF NOT public.ticket_creator_active() OR NOT public.can_manage_tickets() THEN RAISE EXCEPTION 'Sanae ticket creation missing'; END IF;
FOR u IN SELECT id FROM public.user_profiles WHERE id<>'7212fdcc-3bc3-4092-85cc-f96c6821c21e' LOOP
PERFORM set_config('request.jwt.claim.sub',u::text,true);
IF public.ticket_creator_active() THEN RAISE EXCEPTION 'Unexpected ticket creation exception'; END IF;
END LOOP;
PERFORM set_config('request.jwt.claim.sub','',true);
IF public.ticket_creator_active() THEN RAISE EXCEPTION 'Signed-out ticket creation forbidden'; END IF;
END $$;