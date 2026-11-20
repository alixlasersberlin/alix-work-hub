CREATE SCHEMA IF NOT EXISTS fibu_private;
REVOKE ALL ON SCHEMA fibu_private FROM PUBLIC,anon;
GRANT USAGE ON SCHEMA fibu_private TO authenticated,service_role;
ALTER FUNCTION public.fibu_light_due_date_changes() SET SCHEMA fibu_private;
CREATE FUNCTION public.fibu_light_due_date_changes()
RETURNS TABLE(invoice_id uuid,metadata jsonb)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
 SELECT * FROM fibu_private.fibu_light_due_date_changes();
$$;
REVOKE ALL ON FUNCTION public.fibu_light_due_date_changes() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fibu_light_due_date_changes() TO authenticated;