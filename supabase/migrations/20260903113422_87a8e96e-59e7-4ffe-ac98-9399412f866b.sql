DROP POLICY IF EXISTS inbox_media_read ON storage.objects;
CREATE POLICY inbox_media_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'inbox-media');
DROP POLICY IF EXISTS inbox_media_write ON storage.objects;
CREATE POLICY inbox_media_write ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'inbox-media');
DROP POLICY IF EXISTS inbox_media_update ON storage.objects;
CREATE POLICY inbox_media_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'inbox-media') WITH CHECK (bucket_id = 'inbox-media');