GRANT SELECT ON public.roles TO authenticated;

DROP POLICY IF EXISTS "authenticated users can read roles" ON public.roles;
CREATE POLICY "authenticated users can read roles"
ON public.roles
FOR SELECT
TO authenticated
USING (true);