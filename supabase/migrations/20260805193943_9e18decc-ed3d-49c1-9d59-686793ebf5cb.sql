CREATE TABLE public.user_ui_preferences (
  user_id uuid PRIMARY KEY,
  menu_scale numeric(3,2) NOT NULL DEFAULT 1.00,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_ui_preferences_menu_scale_range CHECK (menu_scale >= 0.8 AND menu_scale <= 1.4)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_ui_preferences TO authenticated;
GRANT ALL ON public.user_ui_preferences TO service_role;

ALTER TABLE public.user_ui_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ui_prefs_select_own" ON public.user_ui_preferences
  FOR SELECT TO authenticated USING (user_id = (select auth.uid()));

CREATE POLICY "ui_prefs_insert_own" ON public.user_ui_preferences
  FOR INSERT TO authenticated WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "ui_prefs_update_own" ON public.user_ui_preferences
  FOR UPDATE TO authenticated USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "ui_prefs_delete_superadmin" ON public.user_ui_preferences
  FOR DELETE TO authenticated USING (public.has_role('Super Admin'));

CREATE TRIGGER trg_user_ui_preferences_updated_at
  BEFORE UPDATE ON public.user_ui_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();