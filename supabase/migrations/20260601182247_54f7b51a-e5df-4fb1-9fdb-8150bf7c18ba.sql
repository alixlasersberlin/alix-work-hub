
DROP POLICY IF EXISTS "qm update bugs" ON public.bugs;
CREATE POLICY "super admin update bugs"
ON public.bugs FOR UPDATE TO authenticated
USING (public.has_role('Super Admin'))
WITH CHECK (public.has_role('Super Admin'));

DROP POLICY IF EXISTS "qm update capas" ON public.capas;
CREATE POLICY "super admin update capas"
ON public.capas FOR UPDATE TO authenticated
USING (public.has_role('Super Admin'))
WITH CHECK (public.has_role('Super Admin'));
