ALTER TABLE public.user_ui_preferences
  ADD COLUMN IF NOT EXISTS sidebar_collapsed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sidebar_auto_collapse boolean NOT NULL DEFAULT false;