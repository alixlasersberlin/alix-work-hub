
CREATE TABLE IF NOT EXISTS public.gobd_phase14_test (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.gobd_phase14_test TO service_role;
ALTER TABLE public.gobd_phase14_test ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gobd_test_admin" ON public.gobd_phase14_test FOR ALL TO authenticated
  USING (has_role('Super Admin')) WITH CHECK (has_role('Super Admin'));
CREATE TRIGGER trg_gobd_retention_test BEFORE DELETE ON public.gobd_phase14_test
  FOR EACH ROW EXECUTE FUNCTION public.gobd_retention_delete_guard('TEST_EXPIRED');
