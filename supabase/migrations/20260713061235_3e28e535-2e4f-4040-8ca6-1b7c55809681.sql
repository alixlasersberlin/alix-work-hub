
CREATE POLICY "catalog_media_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'catalog-media');
CREATE POLICY "catalog_media_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'catalog-media' AND public.catalog_can_edit());
CREATE POLICY "catalog_media_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'catalog-media' AND public.catalog_can_edit())
  WITH CHECK (bucket_id = 'catalog-media' AND public.catalog_can_edit());
CREATE POLICY "catalog_media_delete_sa" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'catalog-media' AND has_role('Super Admin'));
