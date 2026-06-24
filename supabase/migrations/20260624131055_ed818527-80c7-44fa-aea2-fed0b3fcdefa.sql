
CREATE POLICY "finance_deposits_storage_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'finance-deposits' AND public.can_view_finance_module());
CREATE POLICY "finance_deposits_storage_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'finance-deposits' AND public.can_access_finance_module());
CREATE POLICY "finance_deposits_storage_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'finance-deposits' AND public.can_access_finance_module());
CREATE POLICY "finance_deposits_storage_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'finance-deposits' AND public.has_role('Super Admin'));
