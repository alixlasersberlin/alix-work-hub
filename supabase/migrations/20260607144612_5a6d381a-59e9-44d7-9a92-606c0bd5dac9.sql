
DO $$ BEGIN
  CREATE POLICY "dispatch-mobile read" ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'dispatch-mobile' AND public.can_access_planning());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "dispatch-mobile insert" ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'dispatch-mobile' AND public.can_access_planning());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "dispatch-mobile update" ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = 'dispatch-mobile' AND public.can_access_planning())
    WITH CHECK (bucket_id = 'dispatch-mobile' AND public.can_access_planning());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "dispatch-mobile delete sa" ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'dispatch-mobile' AND public.has_role('Super Admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
