
-- Allow Order / SACHBEARBEITUNG (Bestellwesen-Bearbeiter) to upload, read and update
-- production order PDFs (excluding the 'invoices' subfolder which stays factory-invoice-only).

DROP POLICY IF EXISTS "order role upload production order pdfs" ON storage.objects;
CREATE POLICY "order role upload production order pdfs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'production-orders'
  AND (storage.foldername(name))[1] <> 'invoices'
  AND (public.has_role('Order') OR public.has_role('SACHBEARBEITUNG'))
);

DROP POLICY IF EXISTS "order role read production order pdfs" ON storage.objects;
CREATE POLICY "order role read production order pdfs"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'production-orders'
  AND (public.has_role('Order') OR public.has_role('SACHBEARBEITUNG'))
);

DROP POLICY IF EXISTS "order role update production order pdfs" ON storage.objects;
CREATE POLICY "order role update production order pdfs"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'production-orders'
  AND (storage.foldername(name))[1] <> 'invoices'
  AND (public.has_role('Order') OR public.has_role('SACHBEARBEITUNG'))
)
WITH CHECK (
  bucket_id = 'production-orders'
  AND (storage.foldername(name))[1] <> 'invoices'
  AND (public.has_role('Order') OR public.has_role('SACHBEARBEITUNG'))
);
