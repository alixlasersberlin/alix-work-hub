DROP POLICY IF EXISTS "Admins can delete backup files" ON storage.objects;
CREATE POLICY "Super admin can delete backup files" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'backups' AND has_role('Super Admin'));

DROP POLICY IF EXISTS "Order managers can delete order invoices" ON storage.objects;
DROP POLICY IF EXISTS "admins can delete order invoices" ON storage.objects;
CREATE POLICY "Super admin can delete order invoices" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'order-invoices' AND has_role('Super Admin'));

DROP POLICY IF EXISTS "admins delete production order pdfs" ON storage.objects;
CREATE POLICY "Super admin delete production order pdfs" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'production-orders' AND has_role('Super Admin'));

DROP POLICY IF EXISTS "alix_sign_pdfs_delete_staff" ON storage.objects;
CREATE POLICY "alix_sign_pdfs_delete_super_admin" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'alix-sign-pdfs' AND has_role('Super Admin'));

DROP POLICY IF EXISTS "bank-offers delete" ON storage.objects;
DROP POLICY IF EXISTS "finance delete bank offers" ON storage.objects;
CREATE POLICY "Super admin delete bank offers" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'bank-offers' AND has_role('Super Admin'));

DROP POLICY IF EXISTS "production-photos admins delete" ON storage.objects;
DROP POLICY IF EXISTS "Suppliers can delete their own production photos" ON storage.objects;
CREATE POLICY "Super admin delete production photos" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'production-photos' AND has_role('Super Admin'));

DROP POLICY IF EXISTS "ticket-attachments delete scoped" ON storage.objects;
CREATE POLICY "ticket-attachments delete super admin" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'ticket-attachments' AND has_role('Super Admin'));

DROP POLICY IF EXISTS "factory invoice can delete invoice files" ON storage.objects;