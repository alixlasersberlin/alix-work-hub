ALTER FUNCTION public.ticket_creator_active() SET SCHEMA lead_private;
ALTER POLICY tickets_creator_insert ON public.tickets WITH CHECK ((SELECT lead_private.ticket_creator_active()) AND created_by=(SELECT auth.uid()) AND source_system='alixwork');
ALTER POLICY tickets_creator_read ON public.tickets USING ((SELECT lead_private.ticket_creator_active()) AND created_by=(SELECT auth.uid()));