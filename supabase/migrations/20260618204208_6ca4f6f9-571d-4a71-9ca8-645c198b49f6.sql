
DROP POLICY IF EXISTS "Internal staff can view offers" ON public.offers;

CREATE POLICY "Offers visible to sales-relevant roles"
ON public.offers
FOR SELECT
TO authenticated
USING (
  public.is_admin()
  OR public.has_role('Vertriebsleitung')
  OR public.has_role('Vertrieb')
  OR public.has_role('Order')
  OR public.has_role('Auftragsverwaltung')
  OR public.has_role('Finance')
  OR public.has_role('SACHBEARBEITUNG')
  OR public.has_role('Geschäftsführung')
  OR created_by = auth.uid()
);
