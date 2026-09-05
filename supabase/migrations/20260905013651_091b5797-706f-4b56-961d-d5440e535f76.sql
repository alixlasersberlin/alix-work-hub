
CREATE POLICY "ph_docs_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'product-hub-docs');
CREATE POLICY "ph_docs_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-hub-docs');
CREATE POLICY "ph_docs_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'product-hub-docs') WITH CHECK (bucket_id = 'product-hub-docs');
CREATE POLICY "ph_docs_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'product-hub-docs' AND public.has_role('Super Admin'));
