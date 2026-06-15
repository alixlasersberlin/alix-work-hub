GRANT SELECT, INSERT, UPDATE, DELETE ON public.bugs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.capas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.capa_actions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_findings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qm_attachments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qm_comments TO authenticated;
GRANT ALL ON public.bugs, public.capas, public.capa_actions, public.audit_findings, public.qm_attachments, public.qm_comments TO service_role;