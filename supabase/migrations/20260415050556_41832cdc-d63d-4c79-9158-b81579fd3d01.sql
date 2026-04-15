
CREATE TABLE public.app_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  value text NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.user_profiles(id)
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "everyone can read app settings"
ON public.app_settings FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "admins can update app settings"
ON public.app_settings FOR UPDATE
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

CREATE POLICY "admins can insert app settings"
ON public.app_settings FOR INSERT
TO authenticated
WITH CHECK (is_admin());

INSERT INTO public.app_settings (key, value) VALUES ('app_version_minor', '0');
