
CREATE POLICY ph_cat_media_obj_read_auth ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'ph-catalog-media');
CREATE POLICY ph_cat_media_obj_read_anon ON storage.objects FOR SELECT TO anon USING (bucket_id = 'ph-catalog-media');
CREATE POLICY ph_cat_media_obj_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'ph-catalog-media' AND public.ph_can_edit());
CREATE POLICY ph_cat_media_obj_update ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'ph-catalog-media' AND public.ph_can_edit()) WITH CHECK (bucket_id = 'ph-catalog-media' AND public.ph_can_edit());
CREATE POLICY ph_cat_media_obj_delete ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'ph-catalog-media' AND public.ph_can_edit());
