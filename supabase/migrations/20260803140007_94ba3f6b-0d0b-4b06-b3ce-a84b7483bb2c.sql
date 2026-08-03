-- 1) device_lock_imports: keine Spaltenrechte auf raw_rows für normale Nutzer
REVOKE SELECT ON public.device_lock_imports FROM authenticated;
GRANT SELECT (id, filename, file_type, row_count, created_by, created_at, updated_at)
  ON public.device_lock_imports TO authenticated;
GRANT ALL ON public.device_lock_imports TO service_role;

DROP POLICY IF EXISTS dli_read ON public.device_lock_imports;
CREATE POLICY dli_read ON public.device_lock_imports
  FOR SELECT TO authenticated
  USING (is_admin() OR can_access_finance());

-- Admin-only Zugriff auf Rohdaten über SECURITY DEFINER Funktion
CREATE OR REPLACE FUNCTION public.device_lock_import_raw_rows(_import_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE WHEN is_admin() THEN (
    SELECT raw_rows FROM public.device_lock_imports WHERE id = _import_id
  ) END;
$$;

REVOKE ALL ON FUNCTION public.device_lock_import_raw_rows(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.device_lock_import_raw_rows(uuid) TO authenticated;

-- 2) survey-media: anonymer Lesezugriff nur auf öffentliche Branding-Ordner
DROP POLICY IF EXISTS survey_media_read ON storage.objects;

CREATE POLICY survey_media_read_public ON storage.objects
  FOR SELECT TO anon
  USING (
    bucket_id = 'survey-media'
    AND (storage.foldername(name))[1] IN ('logos', 'backgrounds', 'hero')
  );

CREATE POLICY survey_media_read_auth ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'survey-media');