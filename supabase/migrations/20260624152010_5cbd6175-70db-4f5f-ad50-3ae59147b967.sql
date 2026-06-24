
CREATE POLICY "fcb_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'finance-cashbook' AND public.can_view_finance_module());
CREATE POLICY "fcb_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'finance-cashbook' AND public.can_access_finance_module());
CREATE POLICY "fcb_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'finance-cashbook' AND public.can_access_finance_module());
CREATE POLICY "fcb_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'finance-cashbook' AND public.has_role('Super Admin'));
