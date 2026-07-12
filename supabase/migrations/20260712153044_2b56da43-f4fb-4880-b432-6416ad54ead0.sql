
-- Tables in public without RLS
CREATE OR REPLACE VIEW public.security_scan_tables_without_rls AS
SELECT n.nspname AS schemaname, c.relname AS tablename
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'r' AND n.nspname = 'public' AND c.relrowsecurity = false;

-- Overly permissive policies (USING true or NULL) on authenticated
CREATE OR REPLACE VIEW public.security_scan_open_policies AS
SELECT schemaname, tablename, policyname, cmd, qual::text AS qual_text
FROM pg_policies
WHERE schemaname = 'public'
  AND cmd IN ('SELECT','UPDATE','DELETE')
  AND (qual = 'true' OR qual IS NULL)
  AND 'authenticated' = ANY(roles);

-- Public storage buckets
CREATE OR REPLACE VIEW public.security_scan_public_buckets AS
SELECT id, name, public FROM storage.buckets WHERE public = true;

-- SECURITY DEFINER functions without search_path
CREATE OR REPLACE VIEW public.security_scan_functions_no_searchpath AS
SELECT p.proname,
       pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prosecdef = true
  AND (p.proconfig IS NULL OR NOT (p.proconfig::text LIKE '%search_path%'));

ALTER VIEW public.security_scan_tables_without_rls SET (security_invoker = on);
ALTER VIEW public.security_scan_open_policies SET (security_invoker = on);
ALTER VIEW public.security_scan_public_buckets SET (security_invoker = on);
ALTER VIEW public.security_scan_functions_no_searchpath SET (security_invoker = on);

GRANT SELECT ON public.security_scan_tables_without_rls TO authenticated, service_role;
GRANT SELECT ON public.security_scan_open_policies TO authenticated, service_role;
GRANT SELECT ON public.security_scan_public_buckets TO authenticated, service_role;
GRANT SELECT ON public.security_scan_functions_no_searchpath TO authenticated, service_role;
