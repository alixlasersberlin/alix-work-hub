DROP POLICY IF EXISTS "suppliers can read own production order pdfs" ON storage.objects;

CREATE POLICY "suppliers can read own production order pdfs"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'production-orders'
  AND is_supplier()
  AND EXISTS (
    SELECT 1 FROM public.production_orders po
    WHERE po.pdf_path = storage.objects.name
      AND po.supplier_id = current_supplier_id()
      AND po.approval_status = 'approved'
  )
);