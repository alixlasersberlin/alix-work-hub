ALTER TABLE public.surveys
  ADD COLUMN IF NOT EXISTS auto_reminder_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_reminder_days integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS auto_reminder_max integer NOT NULL DEFAULT 2;