
CREATE TABLE IF NOT EXISTS public.user_menu_grants (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  PRIMARY KEY (user_id, path)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_menu_grants TO authenticated;
GRANT ALL ON public.user_menu_grants TO service_role;

ALTER TABLE public.user_menu_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own menu grants"
  ON public.user_menu_grants FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role('Super Admin'));

CREATE POLICY "Super Admin manages menu grants"
  ON public.user_menu_grants FOR ALL TO authenticated
  USING (public.has_role('Super Admin'))
  WITH CHECK (public.has_role('Super Admin'));
