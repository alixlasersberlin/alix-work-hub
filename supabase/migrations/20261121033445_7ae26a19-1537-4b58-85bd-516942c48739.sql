CREATE SCHEMA IF NOT EXISTS fibu_due_date_private;
REVOKE ALL ON SCHEMA fibu_due_date_private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA fibu_due_date_private TO authenticated, service_role;
ALTER FUNCTION public.fibu_light_set_due_date(uuid,date,date) SET SCHEMA fibu_due_date_private;
REVOKE ALL ON FUNCTION fibu_due_date_private.fibu_light_set_due_date(uuid,date,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION fibu_due_date_private.fibu_light_set_due_date(uuid,date,date) TO authenticated;
CREATE FUNCTION public.fibu_light_set_due_date(p_invoice_id uuid,p_due_date date,p_expected_due_date date)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path=public
AS $$ SELECT fibu_due_date_private.fibu_light_set_due_date(p_invoice_id,p_due_date,p_expected_due_date); $$;
REVOKE ALL ON FUNCTION public.fibu_light_set_due_date(uuid,date,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fibu_light_set_due_date(uuid,date,date) TO authenticated;