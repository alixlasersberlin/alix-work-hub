
CREATE POLICY "bank_statements_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'bank-statements' AND (public.has_role('Admin') OR public.has_role('Super Admin')));
CREATE POLICY "bank_statements_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'bank-statements' AND (public.has_role('Admin') OR public.has_role('Super Admin')));
