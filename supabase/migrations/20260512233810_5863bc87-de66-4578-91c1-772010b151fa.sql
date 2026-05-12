-- Production photos: allow suppliers to delete their own files (mirrors SELECT/INSERT/UPDATE policies)
DROP POLICY IF EXISTS "Suppliers can delete their own production photos" ON storage.objects;
CREATE POLICY "Suppliers can delete their own production photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'production-photos'
  AND public.is_supplier()
  AND (storage.foldername(name))[1] = public.current_supplier_id()::text
);

-- Order invoices: allow order managers to read uploaded invoices
DROP POLICY IF EXISTS "Order managers can read order invoices" ON storage.objects;
CREATE POLICY "Order managers can read order invoices"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'order-invoices'
  AND public.can_manage_orders()
);

-- Order invoices: allow order managers to update uploaded invoices
DROP POLICY IF EXISTS "Order managers can update order invoices" ON storage.objects;
CREATE POLICY "Order managers can update order invoices"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'order-invoices'
  AND public.can_manage_orders()
)
WITH CHECK (
  bucket_id = 'order-invoices'
  AND public.can_manage_orders()
);

-- Order invoices: allow order managers to delete uploaded invoices
DROP POLICY IF EXISTS "Order managers can delete order invoices" ON storage.objects;
CREATE POLICY "Order managers can delete order invoices"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'order-invoices'
  AND public.can_manage_orders()
);