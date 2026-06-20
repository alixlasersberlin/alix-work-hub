
CREATE TABLE public.sms_settings (
  id boolean PRIMARY KEY DEFAULT true,
  account_sid text,
  auth_token text,
  from_number text,
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  CONSTRAINT sms_settings_singleton CHECK (id = true)
);

GRANT SELECT, INSERT, UPDATE ON public.sms_settings TO authenticated;
GRANT ALL ON public.sms_settings TO service_role;

ALTER TABLE public.sms_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sms_settings admin all"
  ON public.sms_settings FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE TRIGGER trg_sms_settings_updated
  BEFORE UPDATE ON public.sms_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.sms_settings (id) VALUES (true) ON CONFLICT DO NOTHING;
