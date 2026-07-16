
-- Portal-uploads bucket RLS: customer can only read/write within its own customer_id/ prefix
DROP POLICY IF EXISTS portal_uploads_customer_select ON storage.objects;
CREATE POLICY portal_uploads_customer_select ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'portal-uploads'
  AND (storage.foldername(name))[1] = public.current_portal_customer_id()::text
);

DROP POLICY IF EXISTS portal_uploads_customer_insert ON storage.objects;
CREATE POLICY portal_uploads_customer_insert ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'portal-uploads'
  AND (storage.foldername(name))[1] = public.current_portal_customer_id()::text
);

DROP POLICY IF EXISTS portal_uploads_customer_update ON storage.objects;
CREATE POLICY portal_uploads_customer_update ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'portal-uploads'
  AND (storage.foldername(name))[1] = public.current_portal_customer_id()::text
)
WITH CHECK (
  bucket_id = 'portal-uploads'
  AND (storage.foldername(name))[1] = public.current_portal_customer_id()::text
);
