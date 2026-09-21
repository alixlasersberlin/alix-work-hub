REVOKE ALL ON FUNCTION public.op_light_mark_email_opened(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.op_light_mark_email_opened(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.fibu_light_last_emails(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fibu_light_last_emails(uuid[]) TO authenticated, service_role;