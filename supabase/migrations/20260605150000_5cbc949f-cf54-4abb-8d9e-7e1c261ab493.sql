DROP POLICY IF EXISTS "qm read attachments" ON public.qm_attachments;
CREATE POLICY "all authenticated read attachments"
  ON public.qm_attachments FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "qm read bug-capa attachments" ON storage.objects;
CREATE POLICY "all authenticated read bug-capa attachments"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'bug-capa-attachments');