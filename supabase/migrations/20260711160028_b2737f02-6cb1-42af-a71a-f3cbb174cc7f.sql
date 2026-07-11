CREATE TABLE public.media_package_file_downloads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  file_id UUID NOT NULL REFERENCES public.media_package_files(id) ON DELETE CASCADE,
  media_package_id UUID NOT NULL REFERENCES public.media_packages(id) ON DELETE CASCADE,
  downloaded_by UUID REFERENCES auth.users(id),
  downloader_type TEXT NOT NULL DEFAULT 'staff',
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.media_package_file_downloads TO authenticated;
GRANT ALL ON public.media_package_file_downloads TO service_role;
ALTER TABLE public.media_package_file_downloads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view downloads" ON public.media_package_file_downloads FOR SELECT TO authenticated
  USING (public.can_access_media_package(media_package_id));
CREATE POLICY "Staff can log downloads" ON public.media_package_file_downloads FOR INSERT TO authenticated
  WITH CHECK (public.can_access_media_package(media_package_id) AND downloaded_by = auth.uid());
CREATE INDEX idx_mp_file_downloads_file ON public.media_package_file_downloads(file_id, created_at DESC);
CREATE INDEX idx_mp_file_downloads_mp ON public.media_package_file_downloads(media_package_id, created_at DESC);