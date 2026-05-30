-- 1) email_templates: restrict SELECT to admins
DROP POLICY IF EXISTS "Authenticated read templates" ON public.email_templates;
CREATE POLICY "Admins read email templates"
ON public.email_templates
FOR SELECT
TO authenticated
USING (public.is_admin());

-- 2) order_at_approval: remove the permissive "true" SELECT policy
DROP POLICY IF EXISTS "AT approval read" ON public.order_at_approval;

-- 3) Revoke EXECUTE on all SECURITY DEFINER functions in public from anon and PUBLIC
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC, anon;', r.proname, r.args);
  END LOOP;
END $$;