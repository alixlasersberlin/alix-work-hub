CREATE POLICY "qm read capa evidence" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'capa-evidence' AND can_access_qm());
CREATE POLICY "qm upload capa evidence" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'capa-evidence' AND can_access_qm());
CREATE POLICY "qm update capa evidence" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'capa-evidence' AND can_access_qm()) WITH CHECK (bucket_id = 'capa-evidence' AND can_access_qm());
CREATE POLICY "super admin delete capa evidence" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'capa-evidence' AND has_role('Super Admin'));