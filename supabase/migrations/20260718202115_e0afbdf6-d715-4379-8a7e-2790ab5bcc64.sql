
CREATE TABLE IF NOT EXISTS public.alixsmart_reminder_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enabled boolean NOT NULL DEFAULT false,
  channel text NOT NULL DEFAULT 'email' CHECK (channel IN ('email','sms','both')),
  first_after_days int NOT NULL DEFAULT 3,
  second_after_days int NOT NULL DEFAULT 10,
  third_after_days int NOT NULL DEFAULT 21,
  max_reminders int NOT NULL DEFAULT 3,
  quiet_hours_start time DEFAULT '20:00',
  quiet_hours_end time DEFAULT '08:00',
  weekend_pause boolean NOT NULL DEFAULT true,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.alixsmart_reminder_settings TO authenticated;
GRANT ALL ON public.alixsmart_reminder_settings TO service_role;

ALTER TABLE public.alixsmart_reminder_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "as_settings_admin_all" ON public.alixsmart_reminder_settings
  FOR ALL TO authenticated
  USING (public.has_role('Admin') OR public.has_role('Super Admin'))
  WITH CHECK (public.has_role('Admin') OR public.has_role('Super Admin'));

INSERT INTO public.alixsmart_reminder_settings (enabled)
SELECT false WHERE NOT EXISTS (SELECT 1 FROM public.alixsmart_reminder_settings);
