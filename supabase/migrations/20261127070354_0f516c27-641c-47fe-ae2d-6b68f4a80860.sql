CREATE SCHEMA IF NOT EXISTS ph_signal_private;
REVOKE ALL ON SCHEMA ph_signal_private FROM PUBLIC,anon;
GRANT USAGE ON SCHEMA ph_signal_private TO authenticated,service_role;
ALTER FUNCTION public.ph2_retry(uuid) SET SCHEMA ph_signal_private;
CREATE FUNCTION public.ph2_retry(_event_id uuid) RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path=public AS $$ SELECT ph_signal_private.ph2_retry(_event_id); $$;
REVOKE ALL ON FUNCTION public.ph2_retry(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ph2_retry(uuid) TO authenticated,service_role;
