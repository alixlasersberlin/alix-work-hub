CREATE POLICY "survey_media_read" ON storage.objects
  FOR SELECT TO anon, authenticated USING (bucket_id = 'survey-media');
CREATE POLICY "survey_media_insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'survey-media' AND public.sv_can_write());
CREATE POLICY "survey_media_update" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'survey-media' AND public.sv_can_write());
CREATE POLICY "survey_media_delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'survey-media' AND public.sv_can_write());