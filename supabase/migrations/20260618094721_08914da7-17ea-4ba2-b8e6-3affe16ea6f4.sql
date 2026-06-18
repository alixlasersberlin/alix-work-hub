DROP POLICY IF EXISTS "Internal staff can view offers" ON public.offers;

CREATE POLICY "Internal staff can view offers"
ON public.offers
FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid())
);