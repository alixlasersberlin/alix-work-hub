-- Restrict offers SELECT to internal staff only
DROP POLICY IF EXISTS "Anyone authenticated can read offers" ON public.offers;
DROP POLICY IF EXISTS "Authenticated can view offers" ON public.offers;
DROP POLICY IF EXISTS "offers_select_all_authenticated" ON public.offers;
DROP POLICY IF EXISTS "offers_select" ON public.offers;

CREATE POLICY "Internal staff can view offers"
ON public.offers
FOR SELECT
TO authenticated
USING (
  public.can_access_orders()
  OR public.has_role('Vertrieb')
  OR public.has_role('Vertriebsleitung')
  OR public.has_role('Geschäftsführung')
  OR public.has_role('Marketing')
);

-- Storage policies for alix-sign-pdfs bucket (private)
DROP POLICY IF EXISTS "alix_sign_pdfs_select_staff" ON storage.objects;
DROP POLICY IF EXISTS "alix_sign_pdfs_insert_staff" ON storage.objects;
DROP POLICY IF EXISTS "alix_sign_pdfs_update_staff" ON storage.objects;
DROP POLICY IF EXISTS "alix_sign_pdfs_delete_staff" ON storage.objects;

CREATE POLICY "alix_sign_pdfs_select_staff"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'alix-sign-pdfs' AND (public.is_admin() OR public.has_role('Vertrieb') OR public.has_role('Vertriebsleitung')));

CREATE POLICY "alix_sign_pdfs_insert_staff"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'alix-sign-pdfs' AND (public.is_admin() OR public.has_role('Vertrieb') OR public.has_role('Vertriebsleitung')));

CREATE POLICY "alix_sign_pdfs_update_staff"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'alix-sign-pdfs' AND (public.is_admin() OR public.has_role('Vertrieb') OR public.has_role('Vertriebsleitung')));

CREATE POLICY "alix_sign_pdfs_delete_staff"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'alix-sign-pdfs' AND public.is_admin());
