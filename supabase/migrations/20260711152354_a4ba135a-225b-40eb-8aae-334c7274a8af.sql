ALTER TABLE public.media_package_comments REPLICA IDENTITY FULL;
DO $$ BEGIN
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.media_package_comments';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;