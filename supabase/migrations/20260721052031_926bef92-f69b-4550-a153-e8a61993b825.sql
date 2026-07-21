
CREATE TABLE IF NOT EXISTS public.ac_pbx_ivr_menus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  extension text,
  greeting_path text,
  timeout_seconds int NOT NULL DEFAULT 5,
  invalid_action text NOT NULL DEFAULT 'repeat',
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ac_pbx_ivr_menus TO authenticated;
GRANT ALL ON public.ac_pbx_ivr_menus TO service_role;
ALTER TABLE public.ac_pbx_ivr_menus ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ivr read staff" ON public.ac_pbx_ivr_menus FOR SELECT TO authenticated
  USING (public.has_role('Admin') OR public.has_role('Super Admin') OR public.has_role('Order'));
CREATE POLICY "ivr write admin" ON public.ac_pbx_ivr_menus FOR ALL TO authenticated
  USING (public.has_role('Admin') OR public.has_role('Super Admin'))
  WITH CHECK (public.has_role('Admin') OR public.has_role('Super Admin'));

CREATE TABLE IF NOT EXISTS public.ac_pbx_business_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  timezone text NOT NULL DEFAULT 'Europe/Berlin',
  weekly jsonb NOT NULL DEFAULT '{}'::jsonb,
  holidays jsonb NOT NULL DEFAULT '[]'::jsonb,
  closed_greeting_path text,
  closed_action text NOT NULL DEFAULT 'voicemail',
  closed_target text,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ac_pbx_business_hours TO authenticated;
GRANT ALL ON public.ac_pbx_business_hours TO service_role;
ALTER TABLE public.ac_pbx_business_hours ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bh read staff" ON public.ac_pbx_business_hours FOR SELECT TO authenticated
  USING (public.has_role('Admin') OR public.has_role('Super Admin') OR public.has_role('Order'));
CREATE POLICY "bh write admin" ON public.ac_pbx_business_hours FOR ALL TO authenticated
  USING (public.has_role('Admin') OR public.has_role('Super Admin'))
  WITH CHECK (public.has_role('Admin') OR public.has_role('Super Admin'));

DROP TRIGGER IF EXISTS trg_ivr_upd ON public.ac_pbx_ivr_menus;
CREATE TRIGGER trg_ivr_upd BEFORE UPDATE ON public.ac_pbx_ivr_menus
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_bh_upd ON public.ac_pbx_business_hours;
CREATE TRIGGER trg_bh_upd BEFORE UPDATE ON public.ac_pbx_business_hours
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage policies for pbx-audio bucket
CREATE POLICY "pbx-audio read staff" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'pbx-audio' AND (public.has_role('Admin') OR public.has_role('Super Admin') OR public.has_role('Order')));
CREATE POLICY "pbx-audio write admin" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'pbx-audio' AND (public.has_role('Admin') OR public.has_role('Super Admin')));
CREATE POLICY "pbx-audio update admin" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'pbx-audio' AND (public.has_role('Admin') OR public.has_role('Super Admin')));
CREATE POLICY "pbx-audio delete admin" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'pbx-audio' AND (public.has_role('Admin') OR public.has_role('Super Admin')));
