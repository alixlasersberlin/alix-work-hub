DROP POLICY IF EXISTS "anon can read beratung form settings" ON public.app_settings;
CREATE POLICY "anon can read beratung form settings"
ON public.app_settings
FOR SELECT
TO anon
USING (key IN ('beratung_forms','beratung_layout'));