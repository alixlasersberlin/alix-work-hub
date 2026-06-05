
-- Add UPDATE policy on order_documents
CREATE POLICY "authorized roles can update order documents"
ON public.order_documents
FOR UPDATE
USING (can_manage_orders())
WITH CHECK (can_manage_orders());

-- Tighten storage policies for order-invoices to require linkage via order_documents
DROP POLICY IF EXISTS "Order managers can read order invoices" ON storage.objects;
DROP POLICY IF EXISTS "Order managers can update order invoices" ON storage.objects;
DROP POLICY IF EXISTS "Order managers can delete order invoices" ON storage.objects;
DROP POLICY IF EXISTS "admins can read order invoices" ON storage.objects;
DROP POLICY IF EXISTS "admins can delete order invoices" ON storage.objects;

CREATE POLICY "Order managers can read order invoices"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'order-invoices'
  AND can_manage_orders()
  AND EXISTS (SELECT 1 FROM public.order_documents od WHERE od.file_path = storage.objects.name)
);

CREATE POLICY "Order managers can update order invoices"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'order-invoices'
  AND can_manage_orders()
  AND EXISTS (SELECT 1 FROM public.order_documents od WHERE od.file_path = storage.objects.name)
);

CREATE POLICY "Order managers can delete order invoices"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'order-invoices'
  AND can_manage_orders()
  AND EXISTS (SELECT 1 FROM public.order_documents od WHERE od.file_path = storage.objects.name)
);

CREATE POLICY "admins can read order invoices"
ON storage.objects FOR SELECT
USING (bucket_id = 'order-invoices' AND is_admin());

CREATE POLICY "admins can delete order invoices"
ON storage.objects FOR DELETE
USING (bucket_id = 'order-invoices' AND is_admin());
