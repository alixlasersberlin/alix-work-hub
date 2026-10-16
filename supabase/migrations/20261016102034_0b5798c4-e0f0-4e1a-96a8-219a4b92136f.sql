CREATE OR REPLACE FUNCTION public.auto_az_secret_ok(p_secret text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,vault AS $$
 SELECT p_secret IS NOT NULL AND EXISTS(SELECT 1 FROM vault.decrypted_secrets WHERE name='CRON_SECRET' AND decrypted_secret=p_secret);
$$;
REVOKE ALL ON FUNCTION public.auto_az_secret_ok(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.auto_az_secret_ok(text) TO service_role;