DROP POLICY IF EXISTS "factory invoice can read production-orders objects" ON storage.objects;
CREATE POLICY "factory invoice can read production-orders objects"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'production-orders'
    AND can_upload_factory_invoice()
    AND (storage.foldername(name))[1] = 'invoices'
  );