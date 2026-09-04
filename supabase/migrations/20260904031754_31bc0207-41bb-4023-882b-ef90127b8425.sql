-- Lesezugriff auf das CAPA 2.0 Cockpit für alle angemeldeten Mitarbeiter
CREATE POLICY "all authenticated read capas" ON public.capas FOR SELECT TO authenticated USING (true);
CREATE POLICY "all authenticated read capa actions" ON public.capa_actions FOR SELECT TO authenticated USING (true);
CREATE POLICY "all authenticated read capa steps" ON public.capa_step_state FOR SELECT TO authenticated USING (true);
CREATE POLICY "all authenticated read capa timeline" ON public.capa_timeline FOR SELECT TO authenticated USING (true);
CREATE POLICY "all authenticated read capa attachments" ON public.capa_attachments FOR SELECT TO authenticated USING (true);

GRANT SELECT ON public.capas TO authenticated;
GRANT SELECT ON public.capa_actions TO authenticated;
GRANT SELECT ON public.capa_step_state TO authenticated;
GRANT SELECT ON public.capa_timeline TO authenticated;
GRANT SELECT ON public.capa_attachments TO authenticated;