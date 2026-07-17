
-- sig-assets: user-owned files in folder = user id
CREATE POLICY "sig_assets_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'sig-assets' AND (
    public.sig_is_admin() OR (storage.foldername(name))[1] = auth.uid()::text
  ));
CREATE POLICY "sig_assets_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'sig-assets' AND (
    public.sig_is_admin() OR (storage.foldername(name))[1] = auth.uid()::text
  ));
CREATE POLICY "sig_assets_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'sig-assets' AND (
    public.sig_is_admin() OR (storage.foldername(name))[1] = auth.uid()::text
  ));
CREATE POLICY "sig_assets_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'sig-assets' AND (
    public.has_role('Super Admin') OR (storage.foldername(name))[1] = auth.uid()::text
  ));

-- sig-documents: any user with send permission may write; select scoped to admin (edge functions use service role)
CREATE POLICY "sig_docs_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'sig-documents' AND public.sig_is_admin());
CREATE POLICY "sig_docs_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'sig-documents' AND public.sig_can_send());
CREATE POLICY "sig_docs_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'sig-documents' AND public.has_role('Super Admin'));
