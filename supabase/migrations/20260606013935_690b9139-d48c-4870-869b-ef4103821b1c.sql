ALTER TABLE public.mail_campaigns
  ADD COLUMN IF NOT EXISTS language text DEFAULT 'de',
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS target_filter jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS audience_label text,
  ADD COLUMN IF NOT EXISTS recipient_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS error_message text;