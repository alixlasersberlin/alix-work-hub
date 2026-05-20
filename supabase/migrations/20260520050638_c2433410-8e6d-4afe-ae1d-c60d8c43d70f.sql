
-- Allow FACTORY INVOICE (and Super Admin via can_upload_factory_invoice) to read all production order items
CREATE POLICY "factory invoice can read production order items"
ON public.production_order_items
FOR SELECT
TO authenticated
USING (public.can_upload_factory_invoice());

-- Storage: allow read access to production-orders and production-photos buckets for FACTORY INVOICE role
CREATE POLICY "factory invoice can read production-orders objects"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'production-orders' AND public.can_upload_factory_invoice());

CREATE POLICY "factory invoice can read production-photos objects"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'production-photos' AND public.can_upload_factory_invoice());
