DROP POLICY IF EXISTS "cmr_branding_read" ON storage.objects;
CREATE POLICY "cmr_branding_read" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'cmr-branding');

DROP POLICY IF EXISTS "cmr_branding_insert" ON storage.objects;
CREATE POLICY "cmr_branding_insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'cmr-branding');

DROP POLICY IF EXISTS "cmr_branding_update" ON storage.objects;
CREATE POLICY "cmr_branding_update" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'cmr-branding') WITH CHECK (bucket_id = 'cmr-branding');

DROP POLICY IF EXISTS "cmr_branding_delete" ON storage.objects;
CREATE POLICY "cmr_branding_delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'cmr-branding');